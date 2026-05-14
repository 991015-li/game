import type { UIOpacity } from 'cc';
import { Layers, Node, Vec3 } from 'cc';
import { kCoinsPerSuccessfulMatch } from '../configs/EconomyConfig';
import { kPropCaptionGreen } from '../configs/UiWarmPalette';
import type { GamePlayController } from '../controllers/GamePlayController';
import { GameLogicManager, type UndoAnimKind } from '../managers/GameLogicManager';
import type { GameModel } from '../models/GameModel';
import { GameplayRewardService } from '../services/GameplayRewardService';
import { PlayerProgressService } from '../services/PlayerProgressService';
import type { Card } from '../utils/CardEnums';
import { juicePopScale, spawnFloaterLabel, tweenCardFlyArc, tweenCardFlyLinear } from '../utils/JuiceTweens';
import { ccAdd, ccGet } from '../utils/CcEngineComponent';
import { makeCardNode, shakeNodeX } from './CardViewFactory';
import { kHandTopNodeName } from './GameViewBoardRefresh';
import { resolveUndoFlightEndLocal } from './GameViewUndoFlight';

function ensureUIOpacity(n: Node): UIOpacity {
    return ccGet<UIOpacity>(n, 'UIOpacity') ?? ccAdd<UIOpacity>(n, 'UIOpacity');
}

/**
 * 列点击、备用堆抽牌与撤销的飞牌动画与模型提交：**动画结束后** 再调用
 * {@link GameLogicManager} / {@link PlayerProgressService}，并依赖宿主 `refreshFromModel` 重绘。
 */

/** 飞牌/撤销共用依赖（由 {@link GameView} 实现） */
export interface GameViewFlightRuntime {
    /** 对局 shell 根（飞行牌实例的父节点） */
    getRoot(): Node;
    /** 视图是否仍可安全刷新（shell 未销毁） */
    shellAlive(): boolean;
    /** 是否仍有飞牌 tween 未结束（与撤销、点击互斥） */
    getFlyAnimating(): boolean;
    setFlyAnimating(v: boolean): void;
    /** 暂停中禁止列/堆操作 */
    isPaused(): boolean;
    /** 本局玩法与规则入口 */
    controller(): GamePlayController;
    /** 底部手牌/备用堆所在层 */
    handLayer(): Node | null;
    /** 底牌堆「翻开顶」锚点（局部与 shell 一致） */
    handPos(): Readonly<Vec3>;
    /** 备用堆触控参考点 */
    stockPos(): Readonly<Vec3>;
    /** 将任意节点世界/父链坐标转为 shell 根下局部坐标 */
    nodeRootLocal(n: Node): Vec3;
    /** 当前应手牌顶节点中心在根下的局部坐标（飞牌终点） */
    handTopTargetRootLocal(): Vec3;
    /**
     * @param col 列索引
     * @param indexInStack 自下标 0 为列底，递增到列顶
     */
    columnCardRootLocal(col: number, indexInStack: number): Vec3;
    /** 备用堆可点击区在根下的局部坐标 */
    stockPileRootLocal(): Vec3;
    /** 模型变更后整桌刷新 */
    refreshFromModel(): void;
    /** 成功吃牌时累加连击并返回当前连击数 */
    bumpMatchStreak(): number;
    /** 抽牌等打破连击的操作后归零 */
    resetMatchStreak(): void;
    /** 吃牌后的金币飘字、连击与临近清板反馈 */
    juiceMatchReward(endLocal: Vec3, withCoinFx: boolean, streak: number): void;
}

/**
 * 列顶可吃时启动飞牌；否则摇晃列节点。
 *
 * @param rt 宿主运行时
 * @param col 列索引
 * @param colNode 整列容器节点
 * @param baseX 列锚点 X（摇晃复位用）
 * @param topCardNode 当前列顶牌节点
 */
export function onColumnTap(
    rt: GameViewFlightRuntime,
    col: number,
    colNode: Node,
    baseX: number,
    topCardNode: Node
): void {
    if (rt.isPaused() || rt.controller().timedOut || rt.getFlyAnimating()) {
        return;
    }
    const logic = rt.controller().logic;
    if (!logic.canPlayColumn(col)) {
        shakeNodeX(colNode, baseX);
        return;
    }
    const top = logic.getModel().topOfColumn(col);
    if (!top) {
        shakeNodeX(colNode, baseX);
        return;
    }
    runColumnFlyToHand(rt, col, topCardNode, top);
}

/**
 * 将列顶牌平移到手牌顶位置，落地后提交 `tryPlayColumn`（列顶成为新手牌顶、替换原手牌顶）与奖励表现。
 *
 * @param rt 宿主运行时
 * @param col 列索引
 * @param topCardNode 列顶节点
 * @param top 列顶牌数据
 */
export function runColumnFlyToHand(rt: GameViewFlightRuntime, col: number, topCardNode: Node, top: Card): void {
    const startLocal = rt.nodeRootLocal(topCardNode);
    const endLocal = rt.handTopTargetRootLocal();
    const hideOp = ensureUIOpacity(topCardNode);
    hideOp.opacity = 0;
    const fly = makeCardNode({ ...top, faceUp: true }, false);
    fly.layer = Layers.Enum.UI_2D;
    fly.setPosition(startLocal);
    rt.getRoot().addChild(fly);
    rt.setFlyAnimating(true);
    tweenCardFlyLinear(fly, startLocal, endLocal, 0.36, () => {
        rt.setFlyAnimating(false);
        if (!rt.shellAlive()) {
            return;
        }
        if (fly.isValid) {
            fly.destroy();
        }
        if (rt.controller().timedOut) {
            return;
        }
        if (!rt.controller().logic.tryPlayColumn(col)) {
            return;
        }
        const award = GameplayRewardService.shouldAwardMatchCoins(rt.controller().levelId);
        if (award) {
            PlayerProgressService.addCoins(kCoinsPerSuccessfulMatch);
        }
        const streak = rt.bumpMatchStreak();
        rt.refreshFromModel();
        rt.juiceMatchReward(endLocal, award, streak);
    });
}

/**
 * 备用堆可抽时播抽牌动画；不可抽时视情况摇晃触控节点。
 *
 * @param rt 宿主运行时
 */
export function onStockTap(rt: GameViewFlightRuntime): void {
    if (rt.isPaused() || rt.controller().timedOut || rt.getFlyAnimating()) {
        return;
    }
    const logic = rt.controller().logic;
    if (!logic.canDrawStockNow()) {
        if (logic.getModel().getStock().length > 0) {
            const tap = rt.handLayer()?.getChildByName('stockTap');
            if (tap) {
                shakeNodeX(tap, rt.stockPos().x);
            }
        }
        return;
    }
    runStockDrawAnimation(rt);
}

/**
 * 从备用堆顶飞一张到手上，落地后 `tryDrawStock` 并刷新。
 *
 * @param rt 宿主运行时
 */
export function runStockDrawAnimation(rt: GameViewFlightRuntime): void {
    const logic = rt.controller().logic;
    const stock = logic.getModel().getStock();
    if (!stock.length) {
        return;
    }
    const peek = stock[stock.length - 1];
    const stockTap = rt.handLayer()?.getChildByName('stockTap');
    const startLocal = stockTap
        ? rt.nodeRootLocal(stockTap)
        : new Vec3(rt.stockPos().x, rt.stockPos().y, rt.stockPos().z);
    const endLocal = rt.handTopTargetRootLocal();
    const fly = makeCardNode({ ...peek, faceUp: true }, false);
    fly.layer = Layers.Enum.UI_2D;
    fly.setPosition(startLocal);
    rt.getRoot().addChild(fly);
    if (stockTap) {
        const hop = ensureUIOpacity(stockTap);
        hop.opacity = 0;
    }
    rt.setFlyAnimating(true);
    tweenCardFlyArc(fly, startLocal, endLocal, 0.36, () => afterStockFlyCommit(rt, fly, endLocal));
}

function afterStockFlyCommit(rt: GameViewFlightRuntime, fly: Node, endLocal: Vec3): void {
    rt.setFlyAnimating(false);
    if (!rt.shellAlive()) {
        return;
    }
    if (fly.isValid) {
        fly.destroy();
    }
    if (rt.controller().timedOut) {
        return;
    }
    if (!rt.controller().logic.tryDrawStock()) {
        return;
    }
    rt.resetMatchStreak();
    rt.refreshFromModel();
    const h = rt.handLayer()?.getChildByName(kHandTopNodeName);
    if (h) {
        juicePopScale(h, 1.06);
    }
    if (rt.controller().logic.hasAnyBoardMatch()) {
        const tip = endLocal.clone();
        tip.y += 44;
        spawnFloaterLabel(rt.getRoot(), tip, '能接', kPropCaptionGreen);
    }
}

function applyUndoModel(rt: GameViewFlightRuntime, meta: UndoAnimKind | null): void {
    const logic = rt.controller().logic;
    if (!logic.popUndoAndRestore()) {
        return;
    }
    rt.resetMatchStreak();
    if (meta?.type === 'play' && GameplayRewardService.shouldAwardMatchCoins(rt.controller().levelId)) {
        PlayerProgressService.addCoins(-kCoinsPerSuccessfulMatch);
    }
    rt.refreshFromModel();
}

function flyUndoCardArcThenApply(
    rt: GameViewFlightRuntime,
    meta: UndoAnimKind | null,
    cur: GameModel,
    startLocal: Vec3,
    endLocal: Vec3,
): void {
    const flyer = makeCardNode(cur.getHandTop(), false);
    flyer.layer = Layers.Enum.UI_2D;
    const handTop = rt.handLayer()?.getChildByName(kHandTopNodeName);
    if (handTop) {
        ensureUIOpacity(handTop).opacity = 0;
    }
    flyer.setPosition(startLocal);
    rt.getRoot().addChild(flyer);
    rt.setFlyAnimating(true);
    tweenCardFlyArc(flyer, startLocal, endLocal, 0.34, () => {
        rt.setFlyAnimating(false);
        if (!rt.shellAlive()) {
            return;
        }
        if (flyer.isValid) {
            flyer.destroy();
        }
        if (rt.controller().timedOut) {
            return;
        }
        applyUndoModel(rt, meta);
    });
}

/**
 * 在飞牌还原可选时播放撤销飞牌，否则直接回退模型。
 *
 * @param rt 宿主运行时
 */
export function onUndo(rt: GameViewFlightRuntime): void {
    if (rt.isPaused() || rt.controller().timedOut || rt.getFlyAnimating()) {
        return;
    }
    const logic = rt.controller().logic;
    const snap = logic.peekUndoSnapshot();
    if (!snap) {
        return;
    }
    const cur = logic.getModel();
    const meta = GameLogicManager.inferUndoAnimation(cur, snap);
    const startLocal = rt.handTopTargetRootLocal();
    const endLocal = resolveUndoFlightEndLocal(
        meta,
        (c) => cur.getColumns()[c].length,
        (c, i) => rt.columnCardRootLocal(c, i),
        () => rt.stockPileRootLocal(),
    );
    if (!endLocal) {
        applyUndoModel(rt, meta);
        return;
    }
    flyUndoCardArcThenApply(rt, meta, cur, startLocal, endLocal);
}
