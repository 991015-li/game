import { Label, Node, Vec3, view } from 'cc';
import {
    kDesignHeight,
    kDesignWidth,
    kHandStackZoneHeight,
    kMainBoardZoneHeight,
} from '../configs/DesignLayout';
import {
    kPropFreeHintPerLevel,
    kPropFreeRevealPerLevel,
    kPropFreeShuffleStockPerLevel,
    kPropFreeSmallTimePerLevel,
    kPropFreeTimePerLevel,
} from '../configs/GameplayPropsConfig';
import { GamePlayController } from '../controllers/GamePlayController';
import { kCardStackStep } from './CardViewFactory';
import { buildGamePlayChrome } from './GamePlayChrome';
import { attachPropBagPanel, type PropBagPanelApi } from './PropBagPanel';
import { jitterStackOffset, readRootBounds, zoneHeightRatio } from './GameViewBoardLayout';
import { GameViewHudPauseBridge } from './GameViewHudPauseBridge';
import { attachPropsBagRow } from './GameViewPropsBagRow';
import { kHandTopNodeName, rebuildBoardAndHandFromModel, computeStockRowMaxCenterSpan } from './GameViewBoardRefresh';
import { countBoardCards, playMatchJuiceEffects } from './GameViewMatchJuice';
import { onColumnTap, onStockTap, onUndo, type GameViewFlightRuntime } from './GameViewFlightOps';
import {
    runPropHint,
    runPropAddTime,
    runPropSmallTime,
    runPropRevealTop,
    runPropShuffleStock,
    type GameViewPropRuntime,
} from './GameViewPropRuntime';
import {
    restoreEconomyToSnapshot,
    takeLevelStartEconomySnapshot,
    type LevelStartEconomySnapshot,
} from './GameViewSessionEconomy';
import { convertToRootLocal } from './GameViewNodeSpace';
import { resolveBoardLayoutStackStep } from './GameViewBoardResolve';
import {
    computePropsBagRowAnchor,
    syncPropsHudRowPosition,
    syncPropsHudRowZOrder,
} from './GameViewPropsPlacement';
import { buildPropBagRowTextsFromProgress } from './GameViewPropBagTexts';
import { makeGameViewFlightRuntime, makeGameViewPropRuntime, type GameViewRuntimeSink } from './GameViewRuntimeFactories';
import { openFailDialogUi, openWinDialogUi } from './GameViewTimerDialogs';
/**
 * 对局主界面视图：**编排**牌桌节点、HUD、道具入口与胜负弹层；具体布局与飞牌逻辑拆至
 * `GameView*` 系列模块以符合单一职责。
 *
 * **职责**：订阅 {@link GamePlayController} 与 {@link GameLogicManager} 的状态，把点击/道具
 * 转为合法步（经飞牌动画回调提交）；金币展示经 {@link PlayerProgressService}。
 *
 * **使用场景**：`GameBootstrap` 在 `loadLevel` 成功后 `new GameView(shell, ctrl)`；
 * 视图与 shell 同生命周期，回菜单时由 Chrome/弹层回调销毁整棵 UI。
 *
 * **非职责**：不解析关卡 JSON、不持久化进度（由控制器与服务完成）。
 *
 * **可维护性**：牌桌/UI 拼装、飞牌、道具、HUD 与暂停分属 `GameView*` 子模块；本类编排与状态持有。
 *
 * **对外 API**：除构造外无其它 public 方法；对工厂/飞牌以 {@link GameViewRuntimeSink} 形态暴露。
 */
export class GameView {
    /** 设计分辨率回退宽度（根节点无 UITransform 时） */
    private static readonly _fallbackWidth = kDesignWidth;
    /** 设计分辨率回退高度 */
    private static readonly _fallbackHeight = kDesignHeight;
    /** 手牌区在设计稿上的高度，用于按比例换算实际像素 */
    private static readonly _handZoneDesignH = kHandStackZoneHeight;
    /** 主牌区在设计稿上的高度 */
    private static readonly _boardZoneDesignH = kMainBoardZoneHeight;

    /** 全屏 UI shell 根节点（与 Canvas 下节点树一致） */
    private readonly _root: Node;
    /** 本局控制器：模型、规则、超时与胜利结算 */
    private readonly _controller: GamePlayController;
    /** 进入本关时的金币/道具库存快照，用于未通关放弃时回滚 */
    private readonly _economyAtStart: LevelStartEconomySnapshot;

    /** 主牌列父节点（由 {@link buildGamePlayChrome} 创建） */
    private _boardLayer: Node | null = null;
    /** 底部单牌堆层（仅顶牌翻开，余牌背面叠放） */
    private _handLayer: Node | null = null;
    /** 盖牌张数等说明 {@link Label}（可能为 null） */
    private _labelStockCount: Label | null = null;
    /** 底部牌堆锚点（顶牌中心；盖牌由此向左铺开），shell 局部坐标 */
    private _handPos = new Vec3();
    /** 与 {@link _handPos} 同值，供撤销飞牌终点等兼容引用 */
    private _stockPos = new Vec3();
    /** 是否有飞牌动画尚未结束（与撤销、超时判断共享） */
    private _flyAnimating = false;
    /** 局内道具包全屏面板 API；关闭后为 null */
    private _bagPanelApi: PropBagPanelApi | null = null;
    /** 本关开始时刻（ms），用于倒计时与评星用时 */
    private _levelStartMs = 0;
    /** 当前列内叠牌纵向步长（随板深与可视区自适应） */
    private _stackStep = kCardStackStep;
    /** 顶栏金币/限时、暂停与 `setInterval` tick（见 {@link GameViewHudPauseBridge}） */
    private readonly _hudPause: GameViewHudPauseBridge;
    /** 本局剩余免费「提示」次数 */
    private _hintFreeRem = kPropFreeHintPerLevel;
    /** 本局剩余免费「加时」次数 */
    private _timeFreeRem = kPropFreeTimePerLevel;
    /** 本局剩余免费「短补」次数 */
    private _smallTimeFreeRem = kPropFreeSmallTimePerLevel;
    /** 本局剩余免费「亮顶」次数 */
    private _revealTopFreeRem = kPropFreeRevealPerLevel;
    /** 本局剩余免费「洗背」次数 */
    private _shuffleStockFreeRem = kPropFreeShuffleStockPerLevel;

    /** 连续吃牌计数（用于连击表现） */
    private _matchStreak = 0;
    /** 上次吃牌时间戳（ms），用于断连 */
    private _lastMatchAtMs = 0;
    /** 临近清板时是否已播过欢呼（防重复） */
    private _nearWinCheerShown = false;
    /** 两次吃牌相隔超过此毫秒数则重置连击 */
    private static readonly _matchComboGapMs = 3200;

    /** 传给飞牌/列点击模块的运行时闭包（避免环形依赖） */
    private readonly _flightRt: GameViewFlightRuntime;
    /** 传给道具执行模块的运行时闭包 */
    private readonly _propRt: GameViewPropRuntime;

    /**
     * 与 `_leaveToMenu` 共用：`GameBootstrap._clearUiLayers` 直接销毁 shell 时不会走离场逻辑，
     * 需在根节点销毁时幂等释放 `view` 监听与 HUD tick，避免 `canvas-resize` 泄漏。
     */
    private _viewGlobalsReleased = false;

    /** Canvas 尺寸变化时重排顶栏 HUD 与道具包裹行；shell 失效时自动取消订阅 */
    private readonly _onCanvasResizeForHud = (): void => {
        if (!this._root.isValid) {
            view.off('canvas-resize', this._onCanvasResizeForHud, this);
            return;
        }
        this._hudPause.layoutHudStrip();
        this._layoutPropsHudRow();
        syncPropsHudRowZOrder(this._root);
    };

    /**
     * 构建对局视图：要求控制器已完成关卡加载。
     *
     * @param root 与 {@link GameBootstrap} 传入的 shell 根节点一致
     * @param controller 已 `loadLevel` 成功的对局控制器
     * @throws 若 `controller.isReady` 为 false
     */
    constructor(root: Node, controller: GamePlayController) {
        this._root = root;
        this._controller = controller;
        this._economyAtStart = takeLevelStartEconomySnapshot();
        if (!controller.isReady) {
            throw new Error('GamePlayController must be loaded before GameView');
        }
        this._hudPause = new GameViewHudPauseBridge({
            root: this._root,
            getRootBounds: () => this._getRootBounds(),
            getController: () => this._controller,
            getFlyAnimating: () => this._flyAnimating,
            getLevelStartMs: () => this._levelStartMs,
            resetLevelStartToNow: () => {
                this._levelStartMs = Date.now();
            },
            offsetLevelStartByPause: (deltaMs: number) => {
                this._levelStartMs += deltaMs;
            },
            isShellAlive: () => this._isShellAlive(),
            onTimeUpShowFail: () => this._showFailDialog(),
            onPauseBackToMenu: () => this._leaveToMenu(),
        });
        const sink = this as unknown as GameViewRuntimeSink;
        this._flightRt = makeGameViewFlightRuntime(sink);
        this._propRt = makeGameViewPropRuntime(sink, this._flightRt);
        this._buildChrome();
        this._hudPause.attach();
        view.on('canvas-resize', this._onCanvasResizeForHud, this);
        this._root.once(Node.EventType.NODE_DESTROYED, this._releaseViewGlobalResources, this);
        this._attachPropsHud();
        syncPropsHudRowZOrder(this._root);
        this._refreshFromModel();
    }

    private _getRootBounds() {
        return readRootBounds(this._root, GameView._fallbackWidth, GameView._fallbackHeight);
    }

    private _getHandZoneHeight(rootHeight: number): number {
        return zoneHeightRatio(rootHeight, GameView._handZoneDesignH, GameView._fallbackHeight);
    }

    private _getBoardZoneHeight(rootHeight: number): number {
        return zoneHeightRatio(rootHeight, GameView._boardZoneDesignH, GameView._fallbackHeight);
    }

    private _isShellAlive(): boolean {
        return this._root.isValid;
    }

    /** 供飞牌/道具运行时查询是否与 HUD 暂停状态互斥 */
    private _isPaused(): boolean {
        return this._hudPause.isPaused();
    }

    private _updateTimerLabel(): void {
        this._hudPause.refreshTimerLabelNow();
    }

    private _refreshCoinHud(): void {
        this._hudPause.refreshCoinHud();
    }

    private _getHandTopTargetRootLocal(): Vec3 {
        const hl = this._handLayer;
        const named = hl?.getChildByName(kHandTopNodeName);
        if (named) {
            return convertToRootLocal(this._root, named);
        }
        if (!hl || hl.children.length === 0) {
            return new Vec3(this._handPos.x, this._handPos.y, this._handPos.z);
        }
        return convertToRootLocal(this._root, hl.children[hl.children.length - 1]!);
    }

    private _getBoardLayoutMetrics() {
        const { metrics, stackStep } = resolveBoardLayoutStackStep(
            this._root,
            this._controller.logic,
            GameView._fallbackWidth,
            GameView._fallbackHeight,
            GameView._handZoneDesignH,
            GameView._boardZoneDesignH,
        );
        this._stackStep = stackStep;
        return metrics;
    }

    private _getColumnCardRootLocal(col: number, indexInStack: number): Vec3 {
        const m = this._getBoardLayoutMetrics();
        const baseY = m.columnBaseY[col] ?? m.boardAnchorY;
        const off = jitterStackOffset(col, indexInStack);
        const cx = m.startX + col * m.spacing;
        return new Vec3(cx + off.x, baseY + indexInStack * this._stackStep + off.y, 0);
    }

    private _getStockPileRootLocal(): Vec3 {
        const tap = this._handLayer?.getChildByName('stockTap');
        if (tap) {
            return convertToRootLocal(this._root, tap);
        }
        return new Vec3(this._stockPos.x, this._stockPos.y, this._stockPos.z);
    }

    private _buildChrome(): void {
        const bounds = this._getRootBounds();
        const handH = this._getHandZoneHeight(bounds.height);
        const boardH = this._getBoardZoneHeight(bounds.height);
        const chrome = buildGamePlayChrome(this._root, bounds, handH, boardH, {
            onUndo: () => this._onUndo(),
            onResetToStart: () => this._onResetToStart(),
            onMenu: () => this._leaveToMenu(),
        });
        this._boardLayer = chrome.boardLayer;
        this._handLayer = chrome.handLayer;
        this._labelStockCount = chrome.labelStockCount;
        this._handPos.set(chrome.handPos.x, chrome.handPos.y, chrome.handPos.z);
        this._stockPos.set(chrome.stockPos.x, chrome.stockPos.y, chrome.stockPos.z);
    }

    private _propsBagLayoutMetrics() {
        const bounds = this._getRootBounds();
        return {
            bounds,
            handZoneHeight: this._getHandZoneHeight(bounds.height),
            boardZoneHeight: this._getBoardZoneHeight(bounds.height),
        };
    }

    private _attachPropsHud(): void {
        const p = computePropsBagRowAnchor(this._propsBagLayoutMetrics());
        attachPropsBagRow(this._root, p.x, p.y, () => this._openPropBag());
    }

    /** 牌列变化或画布尺寸变化后刷新道具包裹位置（随顶栏/标题区）。 */
    private _layoutPropsHudRow(): void {
        syncPropsHudRowPosition(this._root, computePropsBagRowAnchor(this._propsBagLayoutMetrics()));
    }

    private _openPropBag(): void {
        if (this._bagPanelApi != null || this._controller.timedOut || this._hudPause.isPaused()) {
            return;
        }
        const bounds = this._getRootBounds();
        this._bagPanelApi = attachPropBagPanel(this._root, bounds, {
            onClose: () => this._closePropBag(),
            onHint: () => {
                this._onPropHint();
                this._refreshBagPanelTexts();
            },
            onTime: () => {
                this._onPropAddTime();
                this._refreshBagPanelTexts();
            },
            onSmallTime: () => {
                this._onPropSmallTime();
                this._refreshBagPanelTexts();
            },
            onRevealTop: () => {
                this._onPropRevealTop();
                this._refreshBagPanelTexts();
            },
            onShuffleStock: () => {
                this._onPropShuffleStock();
                this._refreshBagPanelTexts();
            },
        });
        this._bagPanelApi.overlay.setSiblingIndex(this._root.children.length - 1);
        this._refreshBagPanelTexts();
    }

    private _closePropBag(): void {
        const api = this._bagPanelApi;
        this._bagPanelApi = null;
        api?.destroy();
    }

    private _buildBagRowTexts() {
        return buildPropBagRowTextsFromProgress(
            this._hintFreeRem,
            this._timeFreeRem,
            this._smallTimeFreeRem,
            this._revealTopFreeRem,
            this._shuffleStockFreeRem,
        );
    }

    private _refreshBagPanelTexts(): void {
        this._bagPanelApi?.setRowTexts(this._buildBagRowTexts());
    }

    private _resetFreePropUsesAfterEconomyRestore(): void {
        this._hintFreeRem = kPropFreeHintPerLevel;
        this._timeFreeRem = kPropFreeTimePerLevel;
        this._smallTimeFreeRem = kPropFreeSmallTimePerLevel;
        this._revealTopFreeRem = kPropFreeRevealPerLevel;
        this._shuffleStockFreeRem = kPropFreeShuffleStockPerLevel;
        this._refreshBagPanelTexts();
    }

    private _onPropHint(): void {
        runPropHint(this._propRt, this._boardLayer);
    }

    private _onPropAddTime(): void {
        runPropAddTime(this._propRt);
    }

    private _onPropSmallTime(): void {
        runPropSmallTime(this._propRt);
    }

    private _onPropRevealTop(): void {
        runPropRevealTop(this._propRt);
    }

    private _onPropShuffleStock(): void {
        runPropShuffleStock(this._propRt);
    }

    private _refreshFromModel(): void {
        if (!this._isShellAlive() || !this._boardLayer || !this._handLayer || this._controller.timedOut) {
            return;
        }
        const metrics = this._getBoardLayoutMetrics();
        const stockRowMaxCenterSpan = computeStockRowMaxCenterSpan(this._getRootBounds(), this._handPos);
        rebuildBoardAndHandFromModel({
            boardLayer: this._boardLayer,
            handLayer: this._handLayer,
            labelStockCount: this._labelStockCount,
            handPos: this._handPos,
            stockPos: this._stockPos,
            stackStep: this._stackStep,
            stackOffset: jitterStackOffset,
            metrics,
            stockRowMaxCenterSpan,
            logic: this._controller.logic,
            onColumnTap: (c, node, bx, top) => onColumnTap(this._flightRt, c, node, bx, top),
            onStockTap: () => onStockTap(this._flightRt),
        });
        this._hudPause.layoutHudStrip();
        this._hudPause.refreshCoinHud();
        this._layoutPropsHudRow();
        syncPropsHudRowZOrder(this._root);
        this._maybeDispatchWin();
    }

    private _juiceMatchReward(handLocal: Vec3, withCoinFx: boolean, matchStreak: number): void {
        const left = countBoardCards(this._controller.logic.getModel().getColumns());
        const { nearWinCheerShown } = playMatchJuiceEffects({
            root: this._root,
            handLayer: this._handLayer,
            handLocal,
            withCoinFx,
            matchStreak,
            boardCardsLeft: left,
            nearWinCheerShown: this._nearWinCheerShown,
        });
        this._nearWinCheerShown = nearWinCheerShown;
    }

    private _bumpMatchStreak(): number {
        const now = Date.now();
        if (now - this._lastMatchAtMs > GameView._matchComboGapMs) {
            this._matchStreak = 0;
        }
        this._lastMatchAtMs = now;
        this._matchStreak++;
        return this._matchStreak;
    }

    private _resetMatchStreak(): void {
        this._matchStreak = 0;
        this._lastMatchAtMs = 0;
    }

    private _restoreSessionEconomyToLevelStart(): void {
        restoreEconomyToSnapshot(this._economyAtStart, {
            refreshCoinHud: () => this._hudPause.refreshCoinHud(),
            refreshBagTexts: () => this._refreshBagPanelTexts(),
        });
    }

    private _releaseViewGlobalResources(): void {
        if (this._viewGlobalsReleased) {
            return;
        }
        this._viewGlobalsReleased = true;
        view.off('canvas-resize', this._onCanvasResizeForHud, this);
        this._hudPause.dispose();
        this._closePropBag();
    }

    private _leaveToMenu(): void {
        this._releaseViewGlobalResources();
        if (!this._controller.winDispatched) {
            this._restoreSessionEconomyToLevelStart();
        }
        this._controller.backToMenuHandler();
    }

    private _onResetToStart(): void {
        if (this._controller.timedOut || this._flyAnimating) {
            return;
        }
        this._hudPause.resetLevelTimerUi();
        const winOverlay = this._root.getChildByName('winOverlay');
        if (winOverlay?.isValid) {
            winOverlay.destroy();
        }
        this._closePropBag();
        this._controller.resetToLevelStart();
        this._restoreSessionEconomyToLevelStart();
        this._resetFreePropUsesAfterEconomyRestore();
        this._resetMatchStreak();
        this._nearWinCheerShown = false;
        this._refreshFromModel();
    }

    private _onUndo(): void {
        onUndo(this._flightRt);
    }

    private _showFailDialog(): void {
        this._hudPause.applyFailTimerHud(this._controller.effectiveTimeLimitSec);
        openFailDialogUi(this._root, this._getRootBounds(), this._controller, () => this._leaveToMenu());
    }

    private _showWinDialog(): void {
        this._hudPause.stopTimer();
        openWinDialogUi(this._root, this._getRootBounds(), this._controller, () => this._leaveToMenu());
    }

    private _maybeDispatchWin(): void {
        if (this._hudPause.isPaused()) {
            return;
        }
        const elapsedSec = (this._hudPause.nowMsForTimer() - this._levelStartMs) / 1000;
        if (!this._controller.tryMarkWin(elapsedSec)) {
            return;
        }
        this._showWinDialog();
    }
}
