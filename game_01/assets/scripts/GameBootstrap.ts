import { _decorator, Component, Game, Layers, Node as CcNode, ResolutionPolicy, game, profiler, view } from 'cc';
import type { Camera, UITransform, Widget } from 'cc';
import type { LevelIndexEntry } from '../Classes/configs/LevelTypes';
import { kDesignHeight, kDesignWidth } from '../Classes/configs/DesignLayout';
import { getLevelIndexDataCached } from '../Classes/configs/LevelCatalog';
import { GamePlayController } from '../Classes/controllers/GamePlayController';
import { LevelUnlockService } from '../Classes/services/LevelUnlockService';
import { PlayerProgressService } from '../Classes/services/PlayerProgressService';
import { preloadCardSpriteFrames } from '../Classes/views/CardViewFactory';
import { attachGameErrorView } from '../Classes/views/GameErrorView';
import { GameView } from '../Classes/views/GameView';
import { LevelSelectView } from '../Classes/views/LevelSelectView';
import { ccAdd, ccGet } from '../Classes/utils/CcEngineComponent';

const { ccclass } = _decorator;

/**
 * 校验/扣费后是否允许本关开局（进度解锁或金币解锁）。
 *
 * @param entry 关卡索引条目
 * @param maxClearedLevelId 当前存档「最高通关」关卡 id
 * @returns 已通过则 `true`；金币解锁时可能在方法内完成扣费与写解锁 id
 */
function settleLevelEntryAccess(entry: LevelIndexEntry, maxClearedLevelId: number): boolean {
    const coinIds = PlayerProgressService.getCoinUnlockedLevelIds();
    if (LevelUnlockService.canAccessLevel(entry, maxClearedLevelId, coinIds)) {
        return true;
    }
    const cost = LevelUnlockService.getUnlockCoinCost(entry);
    if (cost <= 0) {
        return false;
    }
    if (PlayerProgressService.getCoins() < cost) {
        return false;
    }
    PlayerProgressService.addCoins(-cost);
    PlayerProgressService.addCoinUnlockedLevel(entry.id);
    return true;
}

/**
 * 场景入口：挂在主 Canvas，编排选关与对局界面切换。
 *
 * **职责（单一）**：屏幕流（大厅 ↔ 对局 ↔ 错误页）、shell 创建、设计分辨率、UI 相机同步；不写玩法规则。
 *
 * **使用场景**：`Main.scene` 绑定本组件；冷启动 `start` 进选关，`openLevelSelect` / `startGame` 供胜利返回或重开。
 *
 * 禁止对 Canvas 使用 `removeAllChildren`（会移除子节点上的 Camera）。
 */
@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
    /**
     * 选关 / 开局每次切换 UI 时递增，用于忽略已过期的 `_enterGame` 异步结果（避免在已销毁的 shell 上挂视图）。
     */
    private _uiNavEpoch = 0;
    /** 每次调用 {@link GameBootstrap.startGame} 递增，用于丢弃过期的开局异步校验结果 */
    private _startGameSeq = 0;
    /** 当前选关界面实例（用于回到前台时刷新解锁状态）；对局中 shell 已销毁则刷新为 no-op */
    private _levelSelectRef: LevelSelectView | null = null;
    /** 是否已注册 `Game.EVENT_SHOW`（推迟到 {@link GameBootstrap.start}，避免引擎未就绪时 `game.on` 异常） */
    private _gameShowHooked = false;

    /** 去掉上一次界面节点，保留挂有 Camera 的子节点 */
    private _clearUiLayers(): void {
        const parent = this.node;
        for (let i = parent.children.length - 1; i >= 0; i--) {
            const ch = parent.children[i];
            if (ccGet<Camera>(ch, 'Camera') == null) {
                ch.destroy();
            }
        }
    }

    /** 使 UI 相机的 ortho 与可见层与当前 Canvas 一致 */
    private _syncUiCamera(): void {
        const camNode = this.node.getChildByName('Camera');
        const cam = camNode ? ccGet<Camera>(camNode, 'Camera') : null;
        if (!cam || !camNode) {
            return;
        }
        camNode.layer = Layers.Enum.UI_2D;
        cam.visibility = Layers.Enum.UI_2D | Layers.Enum.DEFAULT | Layers.Enum.UI_3D;
        const canvasUi = ccGet<UITransform>(this.node, 'UITransform');
        const halfH = canvasUi ? canvasUi.height * 0.5 : kDesignHeight * 0.5;
        cam.orthoHeight = halfH;
    }

    /**
     * 创建与 Canvas 同尺寸的 UI shell（四向 Widget 贴边）。
     * @returns shell 根节点
     */
    private _attachShell(): CcNode {
        const shell = new CcNode('shell');
        shell.layer = Layers.Enum.UI_2D;
        shell.parent = this.node;
        const ui = ccAdd<UITransform>(shell, 'UITransform');
        const canvasUi = ccGet<UITransform>(this.node, 'UITransform');
        ui.setContentSize(canvasUi?.width ?? kDesignWidth, canvasUi?.height ?? kDesignHeight);
        const w = ccAdd<Widget>(shell, 'Widget');
        w.isAlignTop = true;
        w.isAlignBottom = true;
        w.isAlignLeft = true;
        w.isAlignRight = true;
        w.top = 0;
        w.bottom = 0;
        w.left = 0;
        w.right = 0;
        w.updateAlignment();
        return shell;
    }

    /**
     * 绑定设计分辨率（固定宽度）与画布缩放；与 `project.json`、`DesignLayout` 常量一致。
     */
    onLoad(): void {
        view.setDesignResolutionSize(kDesignWidth, kDesignHeight, ResolutionPolicy.FIXED_WIDTH);
        view.on('canvas-resize', this._onCanvasResize, this);
        game.once(Game.EVENT_GAME_INITED, () => this._hideProfilerStats());
    }

    /**
     * 取消 `canvas-resize` 监听，避免节点销毁后回调仍触发。
     */
    onDestroy(): void {
        view.off('canvas-resize', this._onCanvasResize, this);
        if (this._gameShowHooked) {
            game.off(Game.EVENT_SHOW, this._onGameShowRefreshSelect, this);
            this._gameShowHooked = false;
        }
    }

    private _onGameShowRefreshSelect(): void {
        this._levelSelectRef?.refreshDotsFromSave();
    }

    private _onCanvasResize(): void {
        this._syncUiCamera();
    }

    private _hideProfilerStats(): void {
        profiler.hideStats();
    }

    /**
     * 同步 UI 相机、预加载牌面图集并打开选关大厅（应用冷启动入口）。
     */
    start(): void {
        this._syncUiCamera();
        this._hideProfilerStats();
        setTimeout(() => this._hideProfilerStats(), 0);
        setTimeout(() => this._hideProfilerStats(), 200);
        preloadCardSpriteFrames();
        void getLevelIndexDataCached();
        this._hookGameShowWhenReady();
        this.openLevelSelect();
    }

    /** 引擎就绪后再挂前台事件，避免首帧 `game.on` 报 ERROR */
    private _hookGameShowWhenReady(): void {
        this.scheduleOnce(() => {
            if (this._gameShowHooked) {
                return;
            }
            try {
                const ev = Game.EVENT_SHOW;
                if (ev != null && typeof game !== 'undefined' && typeof game.on === 'function') {
                    game.on(ev, this._onGameShowRefreshSelect, this);
                    this._gameShowHooked = true;
                }
            } catch {
                /* 无前台刷新也可玩 */
            }
        }, 0);
    }

    /**
     * 清空 UI 子层并展示选关界面。
     *
     * @remarks 胜利返回大厅等场景也可调用本方法复用同一流程。
     * @param toastMessage 进入大厅后在底部提示一条文案（如开局被拒绝说明）
     */
    openLevelSelect(toastMessage?: string): void {
        this._uiNavEpoch += 1;
        this._clearUiLayers();
        const shell = this._attachShell();
        const onPick = (id: number, path: string) => this.startGame(id, path);
        if (toastMessage != null && toastMessage.length > 0) {
            this._levelSelectRef = new LevelSelectView(shell, onPick, toastMessage);
        } else {
            this._levelSelectRef = new LevelSelectView(shell, onPick);
        }
    }

    /**
     * 进入指定关卡：异步加载布局数据后再创建对局视图；失败时展示错误并可返回大厅。
     * @param levelId 关卡 id
     * @param layoutPathNoExt resources 路径，无扩展名
     */
    startGame(levelId: number, layoutPathNoExt: string): void {
        const seq = ++this._startGameSeq;
        void this._startGameWhenAllowed(levelId, layoutPathNoExt, seq);
    }

    /**
     * 加载索引并校验本关是否允许进入（与选关圆点逻辑一致），避免「下一关」等绕过扣费与进度。
     */
    private async _startGameWhenAllowed(
        levelId: number,
        layoutPathNoExt: string,
        startSeq: number
    ): Promise<void> {
        const data = await getLevelIndexDataCached();
        if (startSeq !== this._startGameSeq) {
            return;
        }
        if (data == null) {
            this.openLevelSelect('关卡索引未就绪，无法进行解锁校验，请稍后再试');
            return;
        }
        const entry = data.levels.find((e) => e.id === levelId);
        if (entry == null) {
            this.openLevelSelect('找不到该关卡，请从选关界面进入');
            return;
        }
        const cleared = PlayerProgressService.getMaxClearedLevelId();
        if (!settleLevelEntryAccess(entry, cleared)) {
            this.openLevelSelect('本关尚未解锁，或金币不足。请先在选关界面通关上一关，或准备足够金币以解锁本关');
            return;
        }
        /** 入局时是否已满足「上一关已通」式进度解锁；扣费发生在本帧时 cleared 仍未变，仍为 false，通关不推高主线 */
        const advanceMainProgressOnWin = LevelUnlockService.isLevelUnlockedByProgress(entry, cleared);
        if (startSeq !== this._startGameSeq) {
            return;
        }
        this._levelSelectRef = null;
        this._uiNavEpoch += 1;
        const epoch = this._uiNavEpoch;
        this._clearUiLayers();
        const shell = this._attachShell();
        void this._enterGame(shell, levelId, layoutPathNoExt, epoch, advanceMainProgressOnWin);
    }

    /**
     * 异步加载关卡；失败挂载错误视图。
     *
     * @param shell 新 shell
     * @param levelId 关卡 id
     * @param layoutPathNoExt resources 布局路径
     * @param navEpoch 本次进入对局发起时的 {@link GameBootstrap._uiNavEpoch}，若与当前不一致则说明界面已切换，不得再挂视图
     */
    private async _enterGame(
        shell: CcNode,
        levelId: number,
        layoutPathNoExt: string,
        navEpoch: number,
        advanceMainProgressOnWin: boolean
    ): Promise<void> {
        const ctrl = new GamePlayController(
            levelId,
            layoutPathNoExt,
            () => this.openLevelSelect(),
            (id, path) => this.startGame(id, path),
            advanceMainProgressOnWin
        );
        const loaded = await ctrl.loadLevel();
        if (navEpoch !== this._uiNavEpoch || !shell.isValid) {
            return;
        }
        if (loaded.ok === false) {
            attachGameErrorView(shell, loaded.error, () => this.openLevelSelect());
        } else {
            new GameView(shell, ctrl);
        }
    }
}
