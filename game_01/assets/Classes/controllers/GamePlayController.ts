import { kLevelIndexResource, layoutResourcePathFromIndexFile, loadJsonFromResources } from '../configs/LevelCatalog';
import { parseLevelIndexFromJson } from '../configs/LevelIndexLoader';
import { parseLevelLayoutFromJson } from '../configs/LevelLayoutLoader';
import { GameLogicManager } from '../managers/GameLogicManager';
import { GameModel } from '../models/GameModel';
import { PlayerProgressService } from '../services/PlayerProgressService';
import { starsFromElapsedSeconds, kLevelTimeLimitFirstSec, levelTimeLimitSec } from '../services/LevelStarService';

/**
 * 单局对局控制器：加载关卡资源、创建并持有 {@link GameModel} 与 {@link GameLogicManager}、
 * 解析「下一关」元数据、在适当时机记录通关进度（**仅进度解锁入局**时胜利才推高 `maxClearedLevelId`，
 * 仅凭金币解锁入局时只记星级，不改变上一关/下一关的进度锁态）。
 *
 * **职责**：协调对局入口与数据就绪；不直接创建 UI 节点。
 *
 * **使用场景**：由 `GameBootstrap` 在进入对局前构造并 `await loadLevel()`；视图仅通过本类
 * 读写模型、规则与结算状态。
 *
 * 禁止由 {@link GameLogicManager} 反向依赖本类（便于测试与替换视图）。
 */
export class GamePlayController {
    /** 当前关卡 id（构造注入，整局不变） */
    private readonly _levelId: number;
    /** 本关布局在 `resources` 下的路径，无 `.json` 扩展名 */
    private readonly _layoutPath: string;
    /** 返回选关/大厅的回调（无参数） */
    private readonly _onBackToMenu: () => void;
    /** 跳转并开始指定关卡的回调（重玩、下一关等） */
    private readonly _onStartLevel: (levelId: number, layoutPathNoExt: string) => void;

    /** 牌桌数据模型；`loadLevel` 成功前为 `null` */
    private _model: GameModel | null = null;
    /** 规则与撤销栈管理器；`loadLevel` 成功前为 `null` */
    private _logic: GameLogicManager | null = null;
    /** 关卡索引解析出的「下一关」id 与布局路径；末关或未解析到时为 `null` */
    private _nextLevel: { id: number; path: string } | null = null;
    /** 评星与基础 HUD 倒计时用的本关秒数上限（**不含**道具加时） */
    private _timeLimitSec = kLevelTimeLimitFirstSec;
    /** 本局由道具叠加的额外可玩秒数，仅影响超时判定与显示，**不参与**评星底限 */
    private _bonusTimeSec = 0;
    /** 是否已完成胜利结算并写进度（与超时互斥） */
    private _winDispatched = false;
    /** 是否已标记为限时失败 */
    private _timedOut = false;
    /** 缓存的最近一次胜利评星（`tryMarkWin` 成功时写入） */
    private _lastWinStars = 0;
    /** 缓存的最近一次通关用时（秒，`tryMarkWin` 成功时写入） */
    private _lastWinElapsedSec = 0;
    /**
     * 本局开始时本关是否已满足「靠通关上一关」的进度解锁（而非仅靠金币解锁）。
     * 为 `false` 时胜利只写评星，不写 {@link PlayerProgressService.recordLevelClearedIfBetter}，避免金币跳关通关拉开邻关。
     */
    private readonly _advanceMainProgressOnWin: boolean;

    /**
     * @param levelId 当前关卡 id
     * @param layoutPathNoExt 关卡布局 resources 路径（无扩展名）
     * @param onBackToMenu 返回选关/大厅
     * @param onStartLevel 开始指定关卡（重玩、下一关等）
     * @param advanceMainProgressOnWin 胜利时是否更新「已通最大关卡 id」；若入局仅凭金币解锁则为 `false`
     */
    constructor(
        levelId: number,
        layoutPathNoExt: string,
        onBackToMenu: () => void,
        onStartLevel: (levelId: number, layoutPathNoExt: string) => void,
        advanceMainProgressOnWin: boolean
    ) {
        this._levelId = levelId;
        this._layoutPath = layoutPathNoExt;
        this._onBackToMenu = onBackToMenu;
        this._onStartLevel = onStartLevel;
        this._advanceMainProgressOnWin = advanceMainProgressOnWin;
    }

    /**
     * 当前关卡 id。
     * @returns 构造时注入的关卡标识
     */
    get levelId(): number {
        return this._levelId;
    }

    /**
     * 当前关卡布局在 `resources` 下的路径（无扩展名）。
     * @returns 与构造参数 `layoutPathNoExt` 一致
     */
    get layoutPath(): string {
        return this._layoutPath;
    }

    /**
     * 索引中的下一关元数据。
     * @returns `{ id, path }`；最后一关或未加载索引时为 `null`
     */
    get nextLevel(): { id: number; path: string } | null {
        return this._nextLevel;
    }

    /**
     * 牌桌数据模型（须在 `isReady === true` 后访问）。
     * @returns 非空的 {@link GameModel}
     */
    get model(): GameModel {
        return this._model!;
    }

    /**
     * 玩法与撤销管理器（须在 `isReady === true` 后访问）。
     * @returns 非空的 {@link GameLogicManager}
     */
    get logic(): GameLogicManager {
        return this._logic!;
    }

    /**
     * 是否已完成关卡资源加载。
     * @returns `model` 与 `logic` 均已构造时为 `true`
     */
    get isReady(): boolean {
        return this._model != null && this._logic != null;
    }

    /**
     * 返回大厅回调（供胜利/失败/暂停等 UI 绑定）。
     * @returns 无参函数，调用即回选关或大厅
     */
    get backToMenuHandler(): () => void {
        return this._onBackToMenu;
    }

    /**
     * 开始指定关卡回调（供「重玩」「下一关」等）。
     * @returns `(levelId, layoutPathNoExt) => void`
     */
    get startLevelHandler(): (levelId: number, layoutPathNoExt: string) => void {
        return this._onStartLevel;
    }

    /**
     * 本关**基础**限时秒数（评星与该底限比较；越靠后关卡越短）。
     * @returns 正整数秒
     */
    get timeLimitSec(): number {
        return this._timeLimitSec;
    }

    /**
     * 超时判定与倒计时**显示**用：基础限时 + 本局道具加时。
     * 评星仍只依据 {@link timeLimitSec} 与真实用时。
     * @returns 基础限时与 `_bonusTimeSec` 之和
     */
    get effectiveTimeLimitSec(): number {
        return this._timeLimitSec + this._bonusTimeSec;
    }

    /**
     * 本局增加可用秒数（道具加时）；已超时或已胜利时不生效。
     * @param sec 增加秒数（非正则被忽略）
     * @returns void
     */
    addBonusTimeSec(sec: number): void {
        if (sec <= 0 || this._timedOut || this._winDispatched) {
            return;
        }
        this._bonusTimeSec += Math.floor(sec);
    }

    /**
     * 是否已标记为限时失败。
     * @returns `markTimedOut` 成功后为 `true`
     */
    get timedOut(): boolean {
        return this._timedOut;
    }

    /**
     * 是否已触发胜利结算（主牌清空并写进度）；返回大厅时用于判断是否回滚本局金币消耗。
     * @returns `tryMarkWin` 成功后为 `true`
     */
    get winDispatched(): boolean {
        return this._winDispatched;
    }

    /**
     * 标记为超时失败：主牌未清空时可用；与胜利互斥。
     * @returns 本次是否成功置位（已胜/已超时/无模型时为 `false`）
     */
    markTimedOut(): boolean {
        if (this._winDispatched || this._timedOut || !this._model) {
            return false;
        }
        if (this._model.isBoardEmpty()) {
            return false;
        }
        this._timedOut = true;
        return true;
    }

    /**
     * 将牌桌与撤销栈恢复为进入本关时的状态，并清除胜利/超时、加时与评星缓存（「恢复开局」）。
     * @returns void
     */
    resetToLevelStart(): void {
        if (!this._logic) {
            return;
        }
        this._logic.resetToInitial();
        this._winDispatched = false;
        this._timedOut = false;
        this._lastWinStars = 0;
        this._lastWinElapsedSec = 0;
        this._bonusTimeSec = 0;
    }

    /**
     * 从 `resources` 异步加载本关布局并初始化 `model` / `logic`。
     * @returns `{ ok: true }` 或 `{ ok: false, error: string }`（加载/解析失败）
     */
    async loadLevel(): Promise<{ ok: true } | { ok: false; error: string }> {
        let doc: unknown;
        try {
            doc = await loadJsonFromResources(this._layoutPath);
        } catch {
            return { ok: false, error: '关卡文件加载失败' };
        }
        const parsed = parseLevelLayoutFromJson(doc, { levelId: this._levelId });
        if (parsed.ok === false) {
            return { ok: false, error: parsed.error };
        }
        this._model = new GameModel(parsed.data);
        this._logic = new GameLogicManager(this._model);
        this._winDispatched = false;
        this._timedOut = false;
        this._lastWinStars = 0;
        this._lastWinElapsedSec = 0;
        this._bonusTimeSec = 0;
        await this._resolveNextLevel();
        return { ok: true };
    }

    /**
     * 最近一次胜利评星（仅在 `tryMarkWin` 成功后有效）。
     * @returns `1`～`3`，未成功结算时为 `0`
     */
    get lastWinStars(): number {
        return this._lastWinStars;
    }

    /**
     * 最近一次通关累计用时（秒）。
     * @returns 与最后一次成功 `tryMarkWin` 传入的 `elapsedSeconds` 一致
     */
    get lastWinElapsedSec(): number {
        return this._lastWinElapsedSec;
    }

    /**
     * 主牌清空且尚未结算时：始终写入评星；仅在本局由「上一关已通」的进度条件入局时
     * 才调用 {@link PlayerProgressService.recordLevelClearedIfBetter}（仅凭金币解锁入局时通关不改变邻关进度锁）。
     *
     * 与 `GameViewTimerDialogs.maybeFireTimeUp` / HUD 一致：**已用秒数 ≥ {@link effectiveTimeLimitSec} 时不判胜**
     *（例如最后一手飞牌结束前计时已到期）；此时置 {@link timedOut}，由视图走失败流程。
     *
     * @param elapsedSeconds 从进入本关界面起的累计秒数（可含小数），用于评星
     * @returns 本次是否完成胜利结算；为 `true` 时视图应展示胜利 UI
     */
    tryMarkWin(elapsedSeconds: number): boolean {
        if (this._timedOut || this._winDispatched || !this._model) {
            return false;
        }
        if (!this._model.isBoardEmpty()) {
            return false;
        }
        if (!Number.isFinite(elapsedSeconds) || elapsedSeconds >= this.effectiveTimeLimitSec) {
            this._timedOut = true;
            return false;
        }
        this._winDispatched = true;
        if (this._advanceMainProgressOnWin) {
            PlayerProgressService.recordLevelClearedIfBetter(this._levelId);
        }
        const stars = starsFromElapsedSeconds(elapsedSeconds, this._timeLimitSec);
        PlayerProgressService.recordLevelStarsIfBetter(this._levelId, stars);
        this._lastWinStars = stars;
        this._lastWinElapsedSec = elapsedSeconds;
        return true;
    }

    private async _resolveNextLevel(): Promise<void> {
        this._nextLevel = null;
        this._timeLimitSec = kLevelTimeLimitFirstSec;
        let doc: unknown;
        try {
            doc = await loadJsonFromResources(kLevelIndexResource);
        } catch {
            return;
        }
        const parsed = parseLevelIndexFromJson(doc);
        if (!parsed.ok) {
            return;
        }
        const levels = parsed.data.levels;
        const total = levels.length;
        const curIndex = levels.findIndex((entry) => entry.id === this._levelId);
        const order = curIndex >= 0 ? curIndex + 1 : Math.min(Math.max(1, this._levelId), total);
        this._timeLimitSec = levelTimeLimitSec(order, total);

        if (curIndex < 0 || curIndex >= levels.length - 1) {
            return;
        }
        const next = levels[curIndex + 1];
        this._nextLevel = {
            id: next.id,
            path: layoutResourcePathFromIndexFile(next.file),
        };
    }
}
