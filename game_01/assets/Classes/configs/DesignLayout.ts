/**
 * 设计分辨率与纵向分区常量（与 `settings/v2/packages/project.json` 中 designResolution 保持一致；
 * 运行时在 {@link GameBootstrap.onLoad} 中 `view.setDesignResolutionSize(..., ResolutionPolicy.FIXED_WIDTH)`）。
 * 供 UI 布局按比例换算，无运行时状态。
 */
export const kDesignWidth = 1080;
export const kDesignHeight = 2080;

/** 主牌区（上）设计高度：1080 × 1500（与 {@link kHandStackZoneHeight} 之和 = {@link kDesignHeight}） */
export const kMainBoardZoneHeight = 1500;

/** 堆牌区（下：底牌顶 + 备用盖牌堆等）设计高度：1080 × 580 */
export const kHandStackZoneHeight = 580;

/** 底部单牌堆（仅顶牌翻开，余牌盖放）中心 X（与 {@link buildGamePlayChrome} 一致） */
export const kBottomPileCenterX = 0;

/** @deprecated 与 {@link kBottomPileCenterX} 相同，保留以兼容引用 */
export const kHandPileCenterX = kBottomPileCenterX;
/** @deprecated 与 {@link kBottomPileCenterX} 相同 */
export const kStockPileCenterX = kBottomPileCenterX;

/** 牌堆标题区域近似半宽（HUD 避让用） */
export const kPileCaptionHalfWidth = 90;

/** @deprecated 使用 {@link kPileCaptionHalfWidth} */
export const kStockCaptionHalfWidth = kPileCaptionHalfWidth;

/** 第 1 关及默认基准：从标准 52 张中无放回参与发牌的总张数（主牌区 + 底牌顶 + 备用牌堆） */
export const kGameplayDealCardCount = 25;

/**
 * 随关卡 id 递增的可发牌总数（仍不超过一副 52 张）；更多牌会优先增加备用盖牌堆张数。
 *
 * @param levelId 关卡 id（≥1）
 */
export function dealTotalCardsForLevel(levelId: number): number {
    const id = Math.max(1, Math.floor(levelId));
    return Math.min(52, kGameplayDealCardCount + (id - 1) * 3);
}

/** 对局顶栏 Widget 距屏顶的边距（与 {@link GameViewHudStrip} 内顶对齐一致） */
export const kGamePlayHudTopInsetY = 32;

/** 顶栏条在 UITransform 上的高度（金币/暂停/限时所在行） */
export const kGamePlayHudTopStripHeight = 44;

/** 顶栏底缘与「主牌堆」等区隔标题之间的竖向间隙 */
export const kGamePlayHudBelowTitleGap = 14;

/**
 * 主牌区最顶端向下预留总高度：inset + 条高 + 间隙。
 * 「主牌堆」标题中心 Y 取 `boardZoneTop -` 本值，避免与顶栏限时文案重叠。
 */
export const kGamePlayHudTopBandReserveY =
    kGamePlayHudTopInsetY + kGamePlayHudTopStripHeight + kGamePlayHudBelowTitleGap;

/** 「主牌堆」标题行高度（与 {@link buildGamePlayChrome} 中 UITransform 一致） */
export const kMainPileTitleHeight = 44;

/** 主牌堆标题底缘与「道具包裹」行之间的竖向间隙 */
export const kGamePlayPropsRowBelowTitleGap = 18;

/** 道具包裹行总高度（与 {@link attachPropsBagRow} 根节点一致） */
export const kPropsBagRowHeight = 76;

/** 道具包裹行宽度（与 {@link attachPropsBagRow} 根 UITransform 一致） */
export const kPropsBagRowWidth = 280;

/**
 * 道具入口贴在「主牌区下沿」下方时的留白（落在堆牌区上沿，不挤进主牌列区域）。
 */
export const kGamePlayPropsBagBelowBoardZone = 32;

/** 道具行底缘与底牌堆顶缘之间的最小空隙 */
export const kGamePlayPropsBagHandClearGap = 14;

/** 道具包裹紧挨顶栏（金币行）底缘下方的间隙 */
export const kGamePlayPropsBagBelowHudGap = 10;

/**
 * 道具包裹与主牌在竖直方向上的留白：相对牌列顶/底缘避让。
 */
export const kGamePlayPropsBagBelowCardsGap = 20;

/**
 * 道具行中心不得低于「主牌区下沿 + 本值」，以免贴进堆牌操作区。
 */
export const kGamePlayPropsBagMinAboveBoardZoneBottom = 36;

/**
 * 主牌区顶边 Y（shell 局部）：`bounds.bottom + handH + boardH`。
 */
export function computeBoardZoneTop(boundsBottom: number, handZoneHeight: number, boardZoneHeight: number): number {
    return boundsBottom + handZoneHeight + boardZoneHeight;
}

/**
 * 「道具包裹」行锚点（节点中心）的 Y：紧挨主牌堆标题下方，避免与顶栏/标题/牌列顶端抢位。
 */
export function computePropsBagRowCenterY(
    boundsBottom: number,
    handZoneHeight: number,
    boardZoneHeight: number,
): number {
    const boardTop = computeBoardZoneTop(boundsBottom, handZoneHeight, boardZoneHeight);
    const titleHalf = kMainPileTitleHeight * 0.5;
    const rowHalf = kPropsBagRowHeight * 0.5;
    return (
        boardTop -
        kGamePlayHudTopBandReserveY -
        titleHalf -
        kGamePlayPropsRowBelowTitleGap -
        rowHalf
    );
}
