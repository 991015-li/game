import { Color, Label, Layers, Node } from 'cc';
import type { UITransform } from 'cc';
import { kDesignHeight, kDesignWidth } from '../configs/DesignLayout';
import { getLevelIndexDataCached, layoutResourcePathFromIndexFile } from '../configs/LevelCatalog';
import type { LevelIndexData } from '../configs/LevelTypes';
import { PlayerProgressService } from '../services/PlayerProgressService';
import { LevelUnlockService } from '../services/LevelUnlockService';
import { ccAdd, ccGet } from '../utils/CcEngineComponent';
import { playCoinHudChangedPulse } from './CoinHudFx';
import { attachPropShopPanel } from './PropShopPanel';
import { attachLevelSelectChrome } from './LevelSelectChrome';
import {
    curvePointLocal,
    drawRouteLine,
    makeCurveLevelDot,
    playLevelDotsEntrance,
} from './LevelSelectCurveDots';
import { ensureLevelPathScroll, type PathScrollRefs } from './LevelSelectPathScroll';
import type { LevelRowState } from './LevelSelectTypes';

/**
 * 选关大厅视图：**编排**背景/顶栏、关卡索引加载、曲线路径滚动区与金币解锁交互；具体 UI 搭建拆至
 * {@link attachLevelSelectChrome}、{@link ensureLevelPathScroll}、{@link makeCurveLevelDot} 等模块（单一职责）。
 *
 * **使用场景**：`GameBootstrap` 创建 shell 后 `new LevelSelectView(shell, onPick)`（可选传入进入大厅时的提示），玩家在曲线圆点上选关或金币解锁；
 * `onPick` 接收关卡 id 与无扩展名的 resources 布局路径，用于进入对局。
 *
 * **非职责**：不加载对局牌面、不实现玩法规则；道具商店 UI 由 {@link attachPropShopPanel} 负责。
 */
export class LevelSelectView {
    /** 全屏 shell，与对局共用同一挂载习惯 */
    private readonly _root: Node;
    /** 选中可进入的关卡时回调（进入 `GamePlayController` / `GameView`） */
    private readonly _onPick: (levelId: number, layoutPathNoExt: string) => void;

    /** 曲线路径滚动区外层与 content 引用（可空直至首帧列表构建） */
    private _pathScroll: PathScrollRefs | null = null;
    /** 顶栏金币数字 {@link Label} */
    private _coinValueLabel: Label | null = null;
    /** 底部提示文案 */
    private _toastLabel: Label | null = null;
    /** 成功解析后的关卡索引；加载失败或未就绪时为 null */
    private _indexData: LevelIndexData | null = null;
    /** 用于金币变化时播放顶栏脉冲动画 */
    private _lastSelectCoinValue = -1;
    /** 道具商店全屏遮罩节点（打开时不为 null） */
    private _shopOverlay: Node | null = null;
    /** 索引就绪后展示的一次性提示（如从对局被拒绝返回大厅时由引导层传入） */
    private readonly _initialToast: string | null;

    /**
     * @param root 一般为全屏 shell 节点
     * @param onPick 玩家选中关卡时调用，参数为关卡 id 与布局 resources 路径（无扩展名）
     * @param initialToast 选关界面加载完成后在底部 Toast 区显示的提示；空字符串表示不传
     */
    constructor(
        root: Node,
        onPick: (levelId: number, layoutPathNoExt: string) => void,
        initialToast?: string
    ) {
        this._root = root;
        this._onPick = onPick;
        this._initialToast =
            initialToast != null && initialToast.length > 0 ? initialToast : null;
        const labels = attachLevelSelectChrome(root, () => this._openPropShop());
        this._coinValueLabel = labels.coinValueLabel;
        this._toastLabel = labels.toastLabel;
        this._refreshCoinBar();
        this._syncTopHudZ();
        void this._load();
    }

    /**
     * 选关 shell 仍存在时按**当前存档**重绘圆点（回到游戏前台、或通关写入后需刷新邻关显示时由 {@link GameBootstrap} 调用）。
     */
    refreshDotsFromSave(): void {
        if (!this._root.isValid) {
            return;
        }
        if (!this._indexData) {
            return;
        }
        this._rebuildLevelList();
    }

    /** 顶栏与底部提示置于最上层，避免被关卡列表挡住；商店打开时同步置顶。 */
    private _syncTopHudZ(): void {
        const bar = this._root.getChildByName('coinBar');
        const toastN = this._root.getChildByName('toast');
        if (bar) {
            bar.setSiblingIndex(this._root.children.length - 1);
        }
        if (toastN) {
            toastN.setSiblingIndex(this._root.children.length - 1);
        }
        const shopOv = this._shopOverlay;
        if (shopOv && shopOv.isValid) {
            shopOv.setSiblingIndex(this._root.children.length - 1);
        }
    }

    /** 从 {@link PlayerProgressService} 刷新顶栏金币显示，并在数额变化时播放短时强调动画。 */
    private _refreshCoinBar(): void {
        if (this._coinValueLabel) {
            const n = PlayerProgressService.getCoins();
            this._coinValueLabel.string = `金币 ${n}`;
            if (this._lastSelectCoinValue >= 0 && n !== this._lastSelectCoinValue) {
                const bar = this._root.getChildByName('coinBar');
                if (bar) {
                    playCoinHudChangedPulse(bar);
                }
            }
            this._lastSelectCoinValue = n;
        }
    }

    /**
     * 在底部 Toast 区展示简短提示（空字符串表示清除警告类提示）。
     * @param msg 文案
     */
    private _toast(msg: string): void {
        if (this._toastLabel) {
            this._toastLabel.string = msg;
        }
    }

    /** 打开道具商店遮罩；重复调用会在已打开时忽略。 */
    private _openPropShop(): void {
        if (this._shopOverlay?.isValid) {
            return;
        }
        const shellUi = ccGet<UITransform>(this._root, 'UITransform');
        const rw = shellUi?.width ?? kDesignWidth;
        const rh = shellUi?.height ?? kDesignHeight;
        const bounds = { width: rw, height: rh, left: -rw * 0.5, bottom: -rh * 0.5 };
        this._shopOverlay = attachPropShopPanel(this._root, bounds, {
            onClose: () => {
                if (this._shopOverlay?.isValid) {
                    this._shopOverlay.destroy();
                }
                this._shopOverlay = null;
                this._syncTopHudZ();
            },
            onAfterBuy: () => {
                this._refreshCoinBar();
                this._rebuildLevelList();
            },
            onToast: (msg) => this._toast(msg),
        });
        this._syncTopHudZ();
    }

    /** 异步加载关卡索引 JSON；失败时在根上挂载简单错误 {@link Label}。 */
    private async _load(): Promise<void> {
        const data = await getLevelIndexDataCached();
        if (!data) {
            const err = new Node('err');
            err.layer = Layers.Enum.UI_2D;
            ccAdd<UITransform>(err, 'UITransform').setContentSize(640, 40);
            const lb = ccAdd<Label>(err, 'Label');
            lb.string = '无法加载或解析关卡索引';
            lb.fontSize = 20;
            lb.color = Color.RED;
            err.setPosition(0, 400, 0);
            this._root.addChild(err);
            return;
        }
        this._indexData = data;
        this._rebuildLevelList();
        const tip = this._initialToast;
        if (tip != null) {
            this._toast(tip);
        }

        this._scheduleSelectVisibilityRefresh();
    }

    /**
     * 进入选关后短延迟再按存档刷新一次圆点，覆盖「通关写档略晚于打开大厅」的一帧竞态。
     */
    private _scheduleSelectVisibilityRefresh(): void {
        setTimeout(() => {
            if (!this._root.isValid) {
                return;
            }
            this.refreshDotsFromSave();
        }, 0);
        setTimeout(() => {
            if (!this._root.isValid) {
                return;
            }
            this.refreshDotsFromSave();
        }, 120);
    }

    /** 按当前索引与存档计算每关可见性、金币解锁价与是否仅进度解锁。 */
    private _computeRows(): LevelRowState[] {
        const data = this._indexData;
        if (!data) {
            return [];
        }
        const cleared = PlayerProgressService.getMaxClearedLevelId();
        const coinIds = PlayerProgressService.getCoinUnlockedLevelIds();
        const rows: LevelRowState[] = [];
        for (const e of data.levels) {
            const progressUnlocked = LevelUnlockService.isLevelUnlockedByProgress(e, cleared);
            const accessible = LevelUnlockService.canAccessLevel(e, cleared, coinIds);
            const coinCost = LevelUnlockService.getUnlockCoinCost(e);
            rows.push({ entry: e, accessible, progressUnlocked, coinCost });
        }
        return rows;
    }

    /**
     * 按窗口与关卡数计算曲线路径几何（留白、振幅、圆点半径、纵向步长、内容总高）。
     */
    private _pathScrollMetrics(
        n: number,
        rootW: number,
        rootH: number,
        headerBand: number,
    ): {
        padYTop: number;
        padYBottom: number;
        amp: number;
        radius: number;
        stepY: number;
        contentH: number;
    } {
        const padYTop = 28;
        const padYBottom = 64;
        const amp = Math.min(300, rootW * 0.34);
        const radius = Math.round(Math.min(76, Math.max(58, rootW * 0.118)));
        const stepYIdeal = Math.max(132, Math.round(radius * 2.18));
        const availH = Math.max(340, rootH - headerBand - Math.round(rootH * 0.14)) - 36;
        const stepY =
            n <= 1 ? 0 : Math.max(108, Math.min(stepYIdeal, (availH - padYTop - padYBottom - 2 * radius) / (n - 1)));
        const contentH = padYTop + 2 * radius + Math.max(0, n - 1) * stepY + padYBottom;
        return { padYTop, padYBottom, amp, radius, stepY, contentH };
    }

    /** 根据索引与窗口尺寸重建曲线路径上的全部圆点与连线，并重置滚动位置。 */
    private _rebuildLevelList(): void {
        if (!this._indexData) {
            return;
        }
        this._refreshCoinBar();
        const rows = this._computeRows();
        const shellUi = ccGet<UITransform>(this._root, 'UITransform');
        const rootH = shellUi?.height ?? kDesignHeight;
        const rootW = shellUi?.width ?? kDesignWidth;
        const headerBand = Math.min(380, Math.round(rootH * 0.14 + 208));
        const n = rows.length;
        const { padYTop, amp, radius, stepY, contentH } = this._pathScrollMetrics(n, rootW, rootH, headerBand);

        this._pathScroll = ensureLevelPathScroll(this._root, this._pathScroll, rootW, rootH, headerBand, contentH);
        const content = this._pathScroll.pathContent;
        content.removeAllChildren();

        const coins = PlayerProgressService.getCoins();
        const points: { lx: number; cy: number }[] = [];

        for (let i = 0; i < n; i++) {
            const r = rows[i]!;
            const p = curvePointLocal(i, n, padYTop, radius, stepY, amp);
            points.push(p);
            const path = layoutResourcePathFromIndexFile(r.entry.file);
            const dot = makeCurveLevelDot(r, radius, coins, () => this._onDotClicked(r.entry.id, path));
            dot.setPosition(p.lx, -p.cy, 0);
            content.addChild(dot);
        }

        drawRouteLine(content, points);
        playLevelDotsEntrance(content);

        if (this._pathScroll.scrollComp?.isValid) {
            this._pathScroll.scrollComp.scrollToTop(0);
        }

        this._syncTopHudZ();
    }

    /**
     * 圆点点击：**按当前存档即时重算**解锁状态（避免依赖构建圆点时捕获的过时 {@link LevelRowState}），
     * 可玩则开局；否则在允许金币解锁且余额足够时扣费并开局。
     *
     * @param levelId 关卡 id
     * @param layoutPathNoExt 布局 resources 路径（无扩展名）
     */
    private _onDotClicked(levelId: number, layoutPathNoExt: string): void {
        const data = this._indexData;
        if (!data) {
            return;
        }
        const entry = data.levels.find((e) => e.id === levelId);
        if (!entry) {
            return;
        }
        const cleared = PlayerProgressService.getMaxClearedLevelId();
        const coinIds = PlayerProgressService.getCoinUnlockedLevelIds();
        const accessible = LevelUnlockService.canAccessLevel(entry, cleared, coinIds);
        const coinCost = LevelUnlockService.getUnlockCoinCost(entry);

        if (accessible) {
            this._toast('');
            this._onPick(levelId, layoutPathNoExt);
            return;
        }
        if (coinCost <= 0) {
            this._toast('本关尚未解锁，且不可用金币解锁，请先通关上一关');
            return;
        }
        const coins = PlayerProgressService.getCoins();
        if (coins < coinCost) {
            const lack = coinCost - coins;
            this._toast(`金币不足，无法解锁本关（还需 ${lack} 金币）`);
            return;
        }
        PlayerProgressService.addCoins(-coinCost);
        PlayerProgressService.addCoinUnlockedLevel(levelId);
        this._toast(`已花费 ${coinCost} 金币解锁`);
        this._refreshCoinBar();
        this._rebuildLevelList();
        this._onPick(levelId, layoutPathNoExt);
    }
}
