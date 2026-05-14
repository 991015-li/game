import type { Node, Vec3 } from 'cc';
import type { GamePlayController } from '../controllers/GamePlayController';
import { convertToRootLocal } from './GameViewNodeSpace';
import { runStockDrawAnimation, type GameViewFlightRuntime } from './GameViewFlightOps';
import type { GameViewPropRuntime } from './GameViewPropRuntime';

/**
 * 仅用于 {@link makeGameViewFlightRuntime} / {@link makeGameViewPropRuntime} 的窄依赖视图；
 * 由 {@link GameView} 以 `as unknown as` 传入，避免公开多余字段。
 */
export type GameViewRuntimeSink = {
    readonly _root: Node;
    readonly _controller: GamePlayController;
    _flyAnimating: boolean;
    _isPaused(): boolean;
    _boardLayer: Node | null;
    _handLayer: Node | null;
    _handPos: Vec3;
    _stockPos: Vec3;
    _isShellAlive(): boolean;
    _getHandTopTargetRootLocal(): Vec3;
    _getColumnCardRootLocal(col: number, indexInStack: number): Vec3;
    _getStockPileRootLocal(): Vec3;
    _refreshFromModel(): void;
    _bumpMatchStreak(): number;
    _resetMatchStreak(): void;
    _juiceMatchReward(handLocal: Vec3, withCoinFx: boolean, matchStreak: number): void;
    _refreshCoinHud(): void;
    _updateTimerLabel(): void;
    _refreshBagPanelTexts(): void;
    _hintFreeRem: number;
    _timeFreeRem: number;
    _smallTimeFreeRem: number;
    _revealTopFreeRem: number;
    _shuffleStockFreeRem: number;
};

/**
 * 由 {@link GameView} 以 `as unknown as GameViewRuntimeSink` 传入，生成飞牌/道具两处运行时闭包。
 *
 * @param v 视图 sink（含私有字段访问约定）
 * @returns 飞牌模块用运行时
 */
export function makeGameViewFlightRuntime(v: GameViewRuntimeSink): GameViewFlightRuntime {
    return {
        getRoot: () => v._root,
        shellAlive: () => v._isShellAlive(),
        getFlyAnimating: () => v._flyAnimating,
        setFlyAnimating: (x: boolean) => {
            v._flyAnimating = x;
        },
        isPaused: () => v._isPaused(),
        controller: () => v._controller,
        handLayer: () => v._handLayer,
        handPos: () => v._handPos,
        stockPos: () => v._stockPos,
        nodeRootLocal: (n) => convertToRootLocal(v._root, n),
        handTopTargetRootLocal: () => v._getHandTopTargetRootLocal(),
        columnCardRootLocal: (c, i) => v._getColumnCardRootLocal(c, i),
        stockPileRootLocal: () => v._getStockPileRootLocal(),
        refreshFromModel: () => v._refreshFromModel(),
        bumpMatchStreak: () => v._bumpMatchStreak(),
        resetMatchStreak: () => v._resetMatchStreak(),
        juiceMatchReward: (a, b, c) => v._juiceMatchReward(a, b, c),
    };
}

/**
 * @param v 视图 sink
 * @param flight 与 {@link makeGameViewFlightRuntime} 同源实例（`runStockDrawAnimation`）
 */
export function makeGameViewPropRuntime(v: GameViewRuntimeSink, flight: GameViewFlightRuntime): GameViewPropRuntime {
    return {
        getRoot: () => v._root,
        timedOut: () => v._controller.timedOut,
        flyAnimating: () => v._flyAnimating,
        isPaused: () => v._isPaused(),
        logic: () => v._controller.logic,
        handLayer: () => v._handLayer,
        handPos: () => v._handPos,
        stockPos: () => v._stockPos,
        refreshCoinHud: () => v._refreshCoinHud(),
        updateTimerLabel: () => v._updateTimerLabel(),
        refreshBoardFromModel: () => v._refreshFromModel(),
        refreshBagPanelTexts: () => v._refreshBagPanelTexts(),
        runStockDrawAnimation: () => runStockDrawAnimation(flight),
        hintFreeRem: () => v._hintFreeRem,
        setHintFreeRem: (n) => {
            v._hintFreeRem = n;
        },
        timeFreeRem: () => v._timeFreeRem,
        setTimeFreeRem: (n) => {
            v._timeFreeRem = n;
        },
        smallTimeFreeRem: () => v._smallTimeFreeRem,
        setSmallTimeFreeRem: (n) => {
            v._smallTimeFreeRem = n;
        },
        revealTopFreeRem: () => v._revealTopFreeRem,
        setRevealTopFreeRem: (n) => {
            v._revealTopFreeRem = n;
        },
        shuffleStockFreeRem: () => v._shuffleStockFreeRem,
        setShuffleStockFreeRem: (n) => {
            v._shuffleStockFreeRem = n;
        },
        addBonusTimeSec: (s) => {
            v._controller.addBonusTimeSec(s);
        },
    };
}
