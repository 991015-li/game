import { Node, Vec3 } from 'cc';
import {
    kGamePlayHudTopBandReserveY,
    kGamePlayHudTopInsetY,
    kGamePlayHudTopStripHeight,
    kGamePlayPropsBagBelowHudGap,
    kGamePlayPropsRowBelowTitleGap,
    kMainPileTitleHeight,
    kPropsBagRowHeight,
    computeBoardZoneTop,
} from '../configs/DesignLayout';
import type { RootBounds } from './GameViewBoardLayout';
import { kHudCoinBlockW, kHudTopBarPadLeft, kHudTopBarStripName } from './GameViewHudStrip';

/** {@link computePropsBagRowAnchor} 所需分区尺寸（shell 局部）。 */
export type PropsBagLayoutMetrics = {
    bounds: RootBounds;
    handZoneHeight: number;
    boardZoneHeight: number;
};

/**
 * 道具入口锚点：顶栏金币行正下方、与金币块水平对齐；与「主牌堆」标题冲突时略下移。
 */
export function computePropsBagRowAnchor(m: PropsBagLayoutMetrics): Vec3 {
    const { bounds, handZoneHeight, boardZoneHeight } = m;
    const rowHalf = kPropsBagRowHeight * 0.5;
    const topY = bounds.bottom + bounds.height;
    const hudBottom = topY - kGamePlayHudTopInsetY - kGamePlayHudTopStripHeight;
    let y = hudBottom - kGamePlayPropsBagBelowHudGap - rowHalf;
    const boardTop = computeBoardZoneTop(bounds.bottom, handZoneHeight, boardZoneHeight);
    const titleBottom = boardTop - kGamePlayHudTopBandReserveY - kMainPileTitleHeight * 0.5;
    const maxPropsTop = titleBottom - kGamePlayPropsRowBelowTitleGap;
    if (y + rowHalf > maxPropsTop) {
        y = maxPropsTop - rowHalf;
    }
    const x = bounds.left + kHudTopBarPadLeft + kHudCoinBlockW * 0.5;
    return new Vec3(x, y, 0);
}

/** 将 `propsHud` 节点对齐到给定锚点（根下局部坐标）。 */
export function syncPropsHudRowPosition(root: Node, anchor: Vec3): void {
    const row = root.getChildByName('propsHud');
    if (!row?.isValid) {
        return;
    }
    row.setPosition(anchor.x, anchor.y, anchor.z);
}

/**
 * 顶栏保证最前；道具行次之并在牌层之上，避免被盖牌挡住。
 */
export function syncPropsHudRowZOrder(root: Node): void {
    const topMost = root.children.length - 1;
    const hudTopBar = root.getChildByName(kHudTopBarStripName);
    const propsHud = root.getChildByName('propsHud');
    if (propsHud?.isValid) {
        propsHud.setSiblingIndex(Math.max(0, topMost - 1));
    }
    if (hudTopBar?.isValid) {
        hudTopBar.setSiblingIndex(topMost);
    }
}
