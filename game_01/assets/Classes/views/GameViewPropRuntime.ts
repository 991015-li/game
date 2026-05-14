import { Node, Vec3, tween } from 'cc';
import {
    kPropAddTimeSeconds,
    kPropAddSmallTimeSeconds,
    kPropHintCoinAfterFree,
    kPropRevealCoinAfterFree,
    kPropShuffleStockCoinAfterFree,
    kPropSmallTimeCoinAfterFree,
    kPropTimeCoinAfterFree,
} from '../configs/GameplayPropsConfig';
import type { GameLogicManager } from '../managers/GameLogicManager';
import { PlayerProgressService } from '../services/PlayerProgressService';
import { juicePopScale } from '../utils/JuiceTweens';
import { shakeNodeX } from './CardViewFactory';
import { kHandTopNodeName } from './GameViewBoardRefresh';

/**
 * 局内道具（提示 / 加时 / 短补 / 亮顶 / 洗背）的扣费顺序、动画反馈与与 `GameLogicManager` 的衔接，
 * 由 {@link GameView} 通过 {@link GameViewPropRuntime} 注入依赖。
 */

/** 道具条与扣费/提示动画（由 {@link GameView} 实现） */
export interface GameViewPropRuntime {
    /** 对局 shell 根 */
    getRoot(): Node;
    timedOut(): boolean;
    flyAnimating(): boolean;
    /** 暂停时禁止使用道具 */
    isPaused(): boolean;
    /** 本局规则与牌面 */
    logic(): GameLogicManager;
    handLayer(): Node | null;
    handPos(): Readonly<Vec3>;
    stockPos(): Readonly<Vec3>;
    /** 刷新顶栏金币（扣费后） */
    refreshCoinHud(): void;
    /** 刷新 HUD 限时文案（加秒后） */
    updateTimerLabel(): void;
    /** 牌桌与手牌区与模型同步（亮顶、洗背后调用） */
    refreshBoardFromModel(): void;
    /** 道具包面板说明 */
    refreshBagPanelTexts(): void;
    /** 备用堆合法抽牌时的飞牌（常规点堆，非道具） */
    runStockDrawAnimation(): void;
    /** 本局剩余免费提示次数 */
    hintFreeRem(): number;
    setHintFreeRem(n: number): void;
    timeFreeRem(): number;
    setTimeFreeRem(n: number): void;
    smallTimeFreeRem(): number;
    setSmallTimeFreeRem(n: number): void;
    revealTopFreeRem(): number;
    setRevealTopFreeRem(n: number): void;
    shuffleStockFreeRem(): number;
    setShuffleStockFreeRem(n: number): void;
    /** 叠加本局可用秒数（加到 `GamePlayController`） */
    addBonusTimeSec(sec: number): void;
}

function juiceBagButton(root: Node, peak: number): void {
    const bagSlot = root.getChildByPath('propsHud/bagBtn');
    if (bagSlot) {
        juicePopScale(bagSlot, peak);
    }
}

/**
 * 消耗顺序：本关免费次数 → 永久库存 → 当场扣金币；成功返回 `true`。
 *
 * @param rt 宿主运行时
 * @returns 是否成功扣到一次可用额度
 */
export function tryConsumeHintCharge(rt: GameViewPropRuntime): boolean {
    if (rt.hintFreeRem() > 0) {
        rt.setHintFreeRem(rt.hintFreeRem() - 1);
        return true;
    }
    if (PlayerProgressService.getPropInventoryHint() > 0) {
        PlayerProgressService.addPropInventoryHint(-1);
        return true;
    }
    if (PlayerProgressService.getCoins() >= kPropHintCoinAfterFree) {
        PlayerProgressService.addCoins(-kPropHintCoinAfterFree);
        rt.refreshCoinHud();
        return true;
    }
    return false;
}

/**
 * @param rt 宿主运行时
 * @returns 是否成功消耗一次加时额度
 */
export function tryConsumeTimeCharge(rt: GameViewPropRuntime): boolean {
    if (rt.timeFreeRem() > 0) {
        rt.setTimeFreeRem(rt.timeFreeRem() - 1);
        return true;
    }
    if (PlayerProgressService.getPropInventoryTime() > 0) {
        PlayerProgressService.addPropInventoryTime(-1);
        return true;
    }
    if (PlayerProgressService.getCoins() >= kPropTimeCoinAfterFree) {
        PlayerProgressService.addCoins(-kPropTimeCoinAfterFree);
        rt.refreshCoinHud();
        return true;
    }
    return false;
}

/**
 * @param rt 宿主运行时
 * @returns 是否成功消耗一次短补额度
 */
export function tryConsumeSmallTimeCharge(rt: GameViewPropRuntime): boolean {
    if (rt.smallTimeFreeRem() > 0) {
        rt.setSmallTimeFreeRem(rt.smallTimeFreeRem() - 1);
        return true;
    }
    if (PlayerProgressService.getPropInventorySmallTime() > 0) {
        PlayerProgressService.addPropInventorySmallTime(-1);
        return true;
    }
    if (PlayerProgressService.getCoins() >= kPropSmallTimeCoinAfterFree) {
        PlayerProgressService.addCoins(-kPropSmallTimeCoinAfterFree);
        rt.refreshCoinHud();
        return true;
    }
    return false;
}

/** @param rt 宿主运行时 */
export function tryConsumeRevealTopCharge(rt: GameViewPropRuntime): boolean {
    if (rt.revealTopFreeRem() > 0) {
        rt.setRevealTopFreeRem(rt.revealTopFreeRem() - 1);
        return true;
    }
    if (PlayerProgressService.getPropInventoryReveal() > 0) {
        PlayerProgressService.addPropInventoryReveal(-1);
        return true;
    }
    if (PlayerProgressService.getCoins() >= kPropRevealCoinAfterFree) {
        PlayerProgressService.addCoins(-kPropRevealCoinAfterFree);
        rt.refreshCoinHud();
        return true;
    }
    return false;
}

/** @param rt 宿主运行时 */
export function tryConsumeShuffleStockCharge(rt: GameViewPropRuntime): boolean {
    if (rt.shuffleStockFreeRem() > 0) {
        rt.setShuffleStockFreeRem(rt.shuffleStockFreeRem() - 1);
        return true;
    }
    if (PlayerProgressService.getPropInventoryShuffleStock() > 0) {
        PlayerProgressService.addPropInventoryShuffleStock(-1);
        return true;
    }
    if (PlayerProgressService.getCoins() >= kPropShuffleStockCoinAfterFree) {
        PlayerProgressService.addCoins(-kPropShuffleStockCoinAfterFree);
        rt.refreshCoinHud();
        return true;
    }
    return false;
}

function pulsePlayableColumns(rt: GameViewPropRuntime, board: Node | null): void {
    const logic = rt.logic();
    if (!board) {
        return;
    }
    const n = logic.getModel().getColumns().length;
    for (let c = 0; c < n; c++) {
        if (!logic.canPlayColumn(c)) {
            continue;
        }
        const colNode = board.getChildByName(`col_${c}`);
        if (!colNode) {
            continue;
        }
        const sx = colNode.scale.x;
        const sy = colNode.scale.y;
        tween(colNode)
            .to(0.1, { scale: new Vec3(sx * 1.08, sy * 1.08, 1) })
            .to(0.1, { scale: new Vec3(sx, sy, 1) })
            .to(0.1, { scale: new Vec3(sx * 1.08, sy * 1.08, 1) })
            .to(0.1, { scale: new Vec3(sx, sy, 1) })
            .start();
    }
}

/**
 * 可接列存在时高亮列；否则晃动手牌顶。
 *
 * @param rt 宿主运行时
 * @param boardLayer 主牌区父节点（可为 null）
 */
export function runPropHint(rt: GameViewPropRuntime, boardLayer: Node | null): void {
    if (rt.timedOut() || rt.flyAnimating() || rt.isPaused() || !tryConsumeHintCharge(rt)) {
        return;
    }
    const logic = rt.logic();
    const n = logic.getModel().getColumns().length;
    let any = false;
    for (let i = 0; i < n; i++) {
        if (logic.canPlayColumn(i)) {
            any = true;
            break;
        }
    }
    if (any) {
        pulsePlayableColumns(rt, boardLayer);
        juiceBagButton(rt.getRoot(), 1.08);
    } else {
        const ht = rt.handLayer()?.getChildByName(kHandTopNodeName);
        if (ht) {
            shakeNodeX(ht, rt.handPos().x);
        }
    }
}

/** @param rt 宿主运行时 */
export function runPropAddTime(rt: GameViewPropRuntime): void {
    if (rt.timedOut() || rt.flyAnimating() || rt.isPaused() || !tryConsumeTimeCharge(rt)) {
        return;
    }
    rt.addBonusTimeSec(kPropAddTimeSeconds);
    rt.updateTimerLabel();
    juiceBagButton(rt.getRoot(), 1.1);
}

/** @param rt 宿主运行时 */
export function runPropSmallTime(rt: GameViewPropRuntime): void {
    if (rt.timedOut() || rt.flyAnimating() || rt.isPaused() || !tryConsumeSmallTimeCharge(rt)) {
        return;
    }
    rt.addBonusTimeSec(kPropAddSmallTimeSeconds);
    rt.updateTimerLabel();
    juiceBagButton(rt.getRoot(), 1.06);
}

/**
 * 翻开最左列顶暗牌；无可翻暗顶时不扣费。
 *
 * @param rt 宿主运行时
 */
export function runPropRevealTop(rt: GameViewPropRuntime): void {
    if (rt.timedOut() || rt.flyAnimating() || rt.isPaused()) {
        return;
    }
    const logic = rt.logic();
    if (!logic.hasRevealableFaceDownTop()) {
        return;
    }
    if (!tryConsumeRevealTopCharge(rt)) {
        return;
    }
    logic.tryRevealFirstFaceDownTop();
    rt.refreshBoardFromModel();
    juiceBagButton(rt.getRoot(), 1.07);
}

/**
 * 随机重排备用盖牌堆；不足 2 张时不扣费。
 *
 * @param rt 宿主运行时
 */
export function runPropShuffleStock(rt: GameViewPropRuntime): void {
    if (rt.timedOut() || rt.flyAnimating() || rt.isPaused()) {
        return;
    }
    const logic = rt.logic();
    if (!logic.canShuffleStockForProp()) {
        return;
    }
    if (!tryConsumeShuffleStockCharge(rt)) {
        return;
    }
    logic.tryShuffleStock();
    rt.refreshBoardFromModel();
    juiceBagButton(rt.getRoot(), 1.07);
}
