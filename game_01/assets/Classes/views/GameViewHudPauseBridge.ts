import { Label, Node } from 'cc';
import { kTimerRelaxed } from '../configs/UiWarmPalette';
import type { GamePlayController } from '../controllers/GamePlayController';
import { PlayerProgressService } from '../services/PlayerProgressService';
import { playCoinHudChangedPulse } from './CoinHudFx';
import {
    createHudTopBarStrip,
    kHudTopBarStripName,
    layoutHudTopBarStrip as syncHudTopBarLayout,
} from './GameViewHudStrip';
import { attachGamePauseOverlay } from './GamePauseOverlay';
import { maybeFireTimeUp, paintLevelTimerLabel, paintTimeoutHudMessage } from './GameViewTimerDialogs';
import type { RootBounds } from './GameViewBoardLayout';

/**
 * 对局界面 **顶栏 HUD（金币 / 暂停 / 限时）、限时 tick 与暂停遮罩** 的集中实现。
 *
 * **职责**：装配单条顶栏倒计时 {@link Label}、维护 `setInterval` tick、处理暂停冻结与恢复补偿、
 * 暂停时弹出 {@link attachGamePauseOverlay}；不改变牌桌节点。
 *
 * **使用场景**：仅由 {@link GameView} 在构造时 `attach()`；返回大厅前 `stopTimer()`、`discardPause()`。
 *
 * **非职责**：不刷新牌列、不处理吃牌飞行动画；超时后的失败弹层仅通过回调交给 `GameView`。
 */
export class GameViewHudPauseBridge {
    private readonly _host: GameViewHudPauseHost;

    private _coinLabel: Label | null = null;
    private _timerLabel: Label | null = null;
    private _timerIntervalId: ReturnType<typeof setInterval> | null = null;
    private _paused = false;
    private _pauseClockAnchorMs: number | null = null;
    private _pauseOverlay: Node | null = null;
    private _lastCoinHudValue = -1;

    /**
     * @param host 由 {@link GameView} 提供的根节点、边界与控制逻辑访问器
     */
    constructor(host: GameViewHudPauseHost) {
        this._host = host;
    }

    /**
     * 当前是否处于暂停面板冻结态（胜利/飞牌校验用）。
     * @returns 暂停中为 `true`
     */
    isPaused(): boolean {
        return this._paused;
    }

    /** 首次挂载 HUD 条、启动计时 tick，并将开局时间重置为当前时刻。 */
    attach(): void {
        const bounds = this._host.getRootBounds();
        const bar = createHudTopBarStrip(this._host.root, bounds, {
            onPause: () => this._onPauseTap(),
        });
        this._coinLabel = bar.coinLabel;
        this._timerLabel = bar.timerLabel;
        syncHudTopBarLayout(bar.strip, bounds);
        this._host.resetLevelStartToNow();
        this._timerIntervalId = setInterval(() => this._updateTimerLabel(), 250);
        this._updateTimerLabel();
        this.refreshCoinHud();
    }

    /** Canvas 尺寸变化时与 {@link GameView} 的根边界同步 HUD 布局。 */
    layoutHudStrip(): void {
        const bounds = this._host.getRootBounds();
        const strip = this._host.root.getChildByName(kHudTopBarStripName);
        if (strip?.isValid) {
            syncHudTopBarLayout(strip, bounds);
        }
    }

    /**
     * 从 {@link PlayerProgressService} 刷新顶栏金币文案；数额变化时对 coin 块播放短脉冲。
     */
    refreshCoinHud(): void {
        if (!this._coinLabel || !this._coinLabel.isValid) {
            return;
        }
        const n = PlayerProgressService.getCoins();
        this._coinLabel.string = `金币 ${n}`;
        if (this._lastCoinHudValue >= 0 && n !== this._lastCoinHudValue) {
            const hud = this._host.root.getChildByName(kHudTopBarStripName)?.getChildByName('coinHud');
            if (hud) {
                playCoinHudChangedPulse(hud);
            }
        }
        this._lastCoinHudValue = n;
    }

    /**
     * 道具加时等场景下立即刷新限时文案（不等待下一次 `setInterval` tick）。
     */
    refreshTimerLabelNow(): void {
        this._updateTimerLabel();
    }

    /** 停止限时 `setInterval`（胜利/失败/离场前应调用）。 */
    stopTimer(): void {
        if (this._timerIntervalId != null) {
            clearInterval(this._timerIntervalId);
            this._timerIntervalId = null;
        }
    }

    /**
     * 当前用于倒计时计算的「现在」毫秒：暂停中为冻结戳，否则为真实时间。
     * @returns 毫秒时间戳
     */
    nowMsForTimer(): number {
        if (this._paused && this._pauseClockAnchorMs != null) {
            return this._pauseClockAnchorMs;
        }
        return Date.now();
    }

    /** 销毁暂停遮罩并清除暂停标记（不补偿开局时间偏移）。 */
    discardPause(): void {
        if (this._pauseOverlay?.isValid) {
            this._pauseOverlay.destroy();
        }
        this._pauseOverlay = null;
        this._paused = false;
        this._pauseClockAnchorMs = null;
    }

    /**
     * 整关重开或重来时：清暂停、重置开局时刻、恢复限时 Label 颜色并刷新显示。
     */
    resetLevelTimerUi(): void {
        this.discardPause();
        this._host.resetLevelStartToNow();
        if (this._timerLabel) {
            this._timerLabel.color = kTimerRelaxed;
        }
        this._updateTimerLabel();
    }

    /**
     * 失败结算时：停表并将 HUD 限时文案刷成超时态（失败弹层由外部挂载）。
     * @param limitSec 本关基础限时秒数（展示用）
     */
    applyFailTimerHud(limitSec: number): void {
        this.stopTimer();
        paintTimeoutHudMessage(this._timerLabel, limitSec);
    }

    /**
     * 外部在销毁 `GameView` 前调用：停表、关暂停层、取消对 `view` 的监听（若曾注册）。
     */
    dispose(): void {
        this.stopTimer();
        this.discardPause();
    }

    private _onPauseTap(): void {
        if (this._paused || this._host.getController().timedOut || this._host.getFlyAnimating()) {
            return;
        }
        if (
            this._host.root.getChildByName('winOverlay')?.isValid ||
            this._host.root.getChildByName('failOverlay')?.isValid
        ) {
            return;
        }
        this._paused = true;
        this._pauseClockAnchorMs = Date.now();
        const ov = attachGamePauseOverlay(this._host.root, this._host.getRootBounds(), {
            onResume: () => this._resumeFromPause(),
            onBackToMenu: () => this._pauseAndGoMenu(),
        });
        this._pauseOverlay = ov;
        ov.setSiblingIndex(this._host.root.children.length - 1);
        this._updateTimerLabel();
    }

    private _resumeFromPause(): void {
        if (!this._paused || this._pauseClockAnchorMs == null) {
            return;
        }
        this._host.offsetLevelStartByPause(Date.now() - this._pauseClockAnchorMs);
        this.discardPause();
        this._updateTimerLabel();
    }

    private _pauseAndGoMenu(): void {
        this.discardPause();
        this._host.onPauseBackToMenu();
    }

    private _updateTimerLabel(): void {
        const clock = this.nowMsForTimer();
        paintLevelTimerLabel(
            this._timerLabel,
            this._host.getController().timedOut,
            this._host.getController().effectiveTimeLimitSec,
            this._host.getLevelStartMs(),
            clock,
            (elapsed) => {
                if (this._paused) {
                    return;
                }
                maybeFireTimeUp(
                    elapsed,
                    this._host.getController().effectiveTimeLimitSec,
                    this._host.getFlyAnimating(),
                    () => this._host.getController().markTimedOut(),
                    () => this._host.onTimeUpShowFail(),
                );
            },
        );
    }
}

/**
 * {@link GameViewHudPauseBridge} 所需的宿主回调（由 {@link GameView} 实现），避免桥接类直接依赖视图类型。
 */
export type GameViewHudPauseHost = {
    /** 对局 shell 根节点（与 HUD 同树） */
    root: Node;
    /** 当前 shell 在本地空间的近似外接矩形，供 Widget/暂停蒙版使用 */
    getRootBounds: () => RootBounds;
    /** 本局玩法控制器 */
    getController: () => GamePlayController;
    /** 是否与飞牌动画互斥（暂停入口校验） */
    getFlyAnimating: () => boolean;
    /** 进入本关界面时的逻辑「开局」时间戳（毫秒），用于倒计时 */
    getLevelStartMs: () => number;
    /** 将开局时间设为当前 `Date.now()` */
    resetLevelStartToNow: () => void;
    /** 继续游戏时令开局时刻增加补偿量（暂停时长） */
    offsetLevelStartByPause: (deltaMs: number) => void;
    /** 根节点仍有效（与 shell 生命周期一致） */
    isShellAlive: () => boolean;
    /** 限时用尽且主牌未清时触发（展示失败 UI） */
    onTimeUpShowFail: () => void;
    /** 暂停面板「回菜单」：先清暂停再交给视图离场 */
    onPauseBackToMenu: () => void;
};
