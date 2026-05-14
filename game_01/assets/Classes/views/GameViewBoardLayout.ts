import type { Node } from 'cc';
import { UITransform } from 'cc';
import { kCardHeight, kCardWidth, kCardStackStep } from './CardViewFactory';

/**
 * 牌桌在 shell 内的外接矩形、列间距与锚点计算（无节点创建）。
 */

/** 与 shell 根节点对齐的设计矩形（中心为原点） */
export type RootBounds = { width: number; height: number; left: number; bottom: number };

export interface BoardLayoutMetrics {
    /** 各列公共基准 Y（未叠加 M 形偏移前的纵向参考） */
    boardAnchorY: number;
    /**
     * 每列堆底中心 Y（已含 M 形抬升/压低）；长度与列数一致。
     * 与 {@link boardAnchorY} 关系：`columnBaseY[i] = boardAnchorY + mShapeOffset[i]`。
     */
    columnBaseY: number[];
    /** 列与列之间中心距 */
    spacing: number;
    /** 第 0 列中心 X */
    startX: number;
    colCount: number;
}

/**
 * 读取 shell 根在本地空间的外接矩形（无 UITransform 时用回退设计尺寸）。
 *
 * @param root shell 根节点
 * @param fallbackWidth 设计宽度回退
 * @param fallbackHeight 设计高度回退
 */
export function readRootBounds(root: Node, fallbackWidth: number, fallbackHeight: number): RootBounds {
    const ui = root.getComponent(UITransform);
    const width = ui?.width ?? fallbackWidth;
    const height = ui?.height ?? fallbackHeight;
    return {
        width,
        height,
        left: -width * 0.5,
        bottom: -height * 0.5,
    };
}

/**
 * 将设计稿上的分区高度按比例映射到实际根高度。
 *
 * @param rootHeight 实际 shell 高度
 * @param designZoneH 该分区在设计稿中的高度
 * @param designFullH 设计稿总高度（通常 {@link kDesignHeight}）
 */
export function zoneHeightRatio(rootHeight: number, designZoneH: number, designFullH: number): number {
    return rootHeight * (designZoneH / designFullH);
}

function maxColumnDepth(columns: ReadonlyArray<ReadonlyArray<unknown>>): number {
    let maxDepth = 1;
    for (const c of columns) {
        maxDepth = Math.max(maxDepth, c.length);
    }
    return maxDepth;
}

function resolveStackStep(maxDepth: number, innerV: number): number {
    let stackStep = kCardStackStep;
    if (maxDepth > 1 && innerV > kCardHeight) {
        const needDefault = (maxDepth - 1) * kCardStackStep + kCardHeight;
        if (needDefault > innerV) {
            const slack = innerV - kCardHeight;
            stackStep = Math.max(22, Math.floor(slack / (maxDepth - 1)));
        }
    }
    return stackStep;
}

function resolveBoardAnchorY(
    boardZoneBottom: number,
    boardZoneTop: number,
    maxDepth: number,
    stackStep: number,
    topPad: number
): number {
    const halfCard = kCardHeight * 0.5;
    const stackUp = (maxDepth - 1) * stackStep + halfCard + 10;
    const stackDown = halfCard + 12;
    const bottomPad = 24;
    const midY = (boardZoneBottom + boardZoneTop) * 0.5;
    const minAy = boardZoneBottom + stackDown;
    const maxAy = boardZoneTop - topPad - stackUp;
    if (minAy <= maxAy) {
        return Math.max(minAy, Math.min(maxAy, midY));
    }
    return (minAy + maxAy) * 0.5;
}

/**
 * 主牌列呈 **M 形** 纵向错位：左右及中间略高、谷值在两翼之间，随列数略加大摆幅。
 *
 * @param colIndex 列下标 `0 … colCount-1`
 * @param colCount 列数
 * @param levelId 关卡 id（略抬高后期摆幅）
 */
export function mShapeColumnYOffset(colIndex: number, colCount: number, levelId: number): number {
    if (colCount <= 1) {
        return 0;
    }
    const t = colIndex / (colCount - 1);
    const shape = 1 - Math.abs(Math.sin(t * Math.PI * 2));
    const levelBoost = 1 + Math.min(0.4, Math.max(0, levelId - 1) * 0.035);
    const amp = Math.min(88, (20 + colCount * 6) * levelBoost);
    return shape * amp;
}

function resolveSpacingAndStartX(boundsWidth: number, colCount: number): { spacing: number; startX: number } {
    const padX = 28;
    const innerW = Math.max(kCardWidth + 16, boundsWidth - padX * 2);
    let spacing: number;
    if (colCount <= 1) {
        spacing = kCardWidth + 16;
    } else {
        spacing = (innerW - kCardWidth) / (colCount - 1);
        spacing = Math.max(kCardWidth + 6, Math.min(182, spacing));
        const span = (colCount - 1) * spacing + kCardWidth;
        if (span > innerW) {
            spacing = (innerW - kCardWidth) / (colCount - 1);
        }
    }
    const totalW = spacing * Math.max(0, colCount - 1);
    const startX = -totalW * 0.5;
    return { spacing, startX };
}

/**
 * 主牌区列间距、锚点 Y、叠放步长（步长写回由调用方同步到视图状态）。
 */
export function computeBoardLayoutMetrics(
    bounds: RootBounds,
    handZoneH: number,
    boardZoneH: number,
    columns: ReadonlyArray<ReadonlyArray<unknown>>,
    levelId: number,
): { metrics: BoardLayoutMetrics; stackStep: number } {
    const boardZoneBottom = bounds.bottom + handZoneH;
    const boardZoneTop = boardZoneBottom + boardZoneH;
    const colCount = columns.length;
    const maxDepth = maxColumnDepth(columns);
    const topPad = 168;
    const bottomPad = 24;
    const innerV = boardZoneTop - topPad - (boardZoneBottom + bottomPad);
    const stackStep = resolveStackStep(maxDepth, innerV);
    const boardAnchorY = resolveBoardAnchorY(boardZoneBottom, boardZoneTop, maxDepth, stackStep, topPad);
    const { spacing, startX } = resolveSpacingAndStartX(bounds.width, colCount);
    const columnBaseY: number[] = [];
    for (let c = 0; c < colCount; c++) {
        columnBaseY.push(boardAnchorY + mShapeColumnYOffset(c, colCount, levelId));
    }
    return {
        metrics: { boardAnchorY, columnBaseY, spacing, startX, colCount },
        stackStep,
    };
}

/** 单张牌在列内轻微错位，避免完全重叠。 */
export function jitterStackOffset(colIndex: number, cardIndex: number): { x: number; y: number } {
    const seed = colIndex * 37 + cardIndex * 17;
    const xPattern = [0, -3, 2, -2, 3, -1, 1];
    const yPattern = [0, -1, 1, 0, -1, 1, 0];
    return { x: xPattern[seed % xPattern.length], y: yPattern[seed % yPattern.length] };
}
