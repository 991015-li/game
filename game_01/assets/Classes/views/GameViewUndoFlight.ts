import { Vec3 } from 'cc';
import type { UndoAnimKind } from '../managers/GameLogicManager';

/** 由撤销元数据解算飞牌终点（手牌局部 → 根节点）。 */
export function resolveUndoFlightEndLocal(
    meta: UndoAnimKind | null,
    colLen: (col: number) => number,
    columnCardRootLocal: (col: number, indexInStack: number) => Vec3,
    stockPileRootLocal: () => Vec3
): Vec3 | null {
    if (meta?.type === 'draw') {
        return stockPileRootLocal();
    }
    if (meta?.type === 'play') {
        const L = colLen(meta.col);
        return columnCardRootLocal(meta.col, L);
    }
    return null;
}
