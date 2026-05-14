import { Label, Layers, Node, UIOpacity, Vec3 } from 'cc';
import type { GameLogicManager } from '../managers/GameLogicManager';
import type { Card } from '../utils/CardEnums';
import { attachTap, kCardWidth, makeCardNode, makeFaceDownCardNode } from './CardViewFactory';
import type { BoardLayoutMetrics } from './GameViewBoardLayout';

/**
 * 主牌列、底牌顶与备用盖牌节点的**整桌重建**（先清空再按模型生成）；触摸绑定与列名规则与
 * {@link GameView} 约定一致。
 */

/** 底牌唯一朝上的那张，供 {@link GameView} 与特效定位（须与重建逻辑一致） */
export const kHandTopNodeName = 'handTop';

/** 盖牌横向一字排开时的中心距上界（视觉舒适） */
const kFaceDownOverlapStepMax = 56;
/**
 * 盖牌行允许的最左中心：最左盖牌左缘不得越过 `bounds.left + edgePad`；
 * 由此得到「最右盖牌中心 → 最左盖牌中心」的最大距离，再除以 (n-1) 得步长。
 */
const kStockRowEdgePad = 16;
/** 明牌左缘与最右盖牌右缘之间的缝 */
const kHandToCoverStockGap = 8;

/**
 * 计算盖牌从右到左铺开时，相邻牌**中心距**的上限（再交给 {@link faceDownRowStepX} 压缩）。
 */
export function computeStockRowMaxCenterSpan(bounds: { left: number }, handPos: Readonly<Vec3>): number {
    const rightBackCenterX = handPos.x - kCardWidth - kHandToCoverStockGap;
    const limitLeftCenter = bounds.left + kStockRowEdgePad + kCardWidth * 0.5;
    return Math.max(40, rightBackCenterX - limitLeftCenter);
}

function faceDownRowStepX(stockCount: number, maxCenterSpan: number): number {
    if (stockCount <= 1) {
        return kFaceDownOverlapStepMax;
    }
    const ideal = maxCenterSpan / Math.max(1, stockCount - 1);
    return Math.min(kFaceDownOverlapStepMax, Math.max(0.5, ideal));
}

export interface RebuildBoardOptions {
    /** 主牌各列父节点 */
    boardLayer: Node;
    /** 底牌与备用堆父节点 */
    handLayer: Node;
    labelStockCount: Label | null;
    handPos: Readonly<Vec3>;
    stockPos: Readonly<Vec3>;
    /** 列几何与锚点（与 {@link resolveBoardLayoutStackStep} 的 `metrics` 一致） */
    metrics: BoardLayoutMetrics;
    /** 对局逻辑：读模型、列可点性 */
    logic: GameLogicManager;
    /** 列内纵向叠牌间距 */
    stackStep: number;
    /** 列/张随机微偏（防完全对齐） */
    stackOffset: (col: number, cardIndex: number) => { x: number; y: number };
    /** 盖牌行在屏宽内的最大中心跨距（由 {@link computeStockRowMaxCenterSpan} 得到） */
    stockRowMaxCenterSpan: number;
    onColumnTap: (col: number, colNode: Node, baseX: number, topCard: Node) => void;
    onStockTap: () => void;
}

/**
 * 排列各 `col_*` 的 sibling，减少明牌被邻列盖住：
 * - 主要以列顶 Y 升序绘制（矮堆先画、高堆后画）；
 * - 列顶接近时 **列号大的先画、列号小的后画**，使偏左的列叠在右邻之上（牌宽重叠时更易读到明牌）。
 */
function orderBoardColumnsByStackTop(
    boardLayer: Node,
    cols: ReadonlyArray<ReadonlyArray<Card>>,
    columnBaseY: ReadonlyArray<number>,
    stackStep: number,
    stackOffset: (col: number, cardIndex: number) => { x: number; y: number },
): void {
    const tieY = 10;
    type Entry = { node: Node; topY: number; col: number };
    const entries: Entry[] = [];
    for (let col = 0; col < cols.length; col++) {
        const node = boardLayer.getChildByName(`col_${col}`);
        if (!node) {
            continue;
        }
        const stack = cols[col];
        const baseY = columnBaseY[col] ?? 0;
        let topY = baseY;
        if (stack.length > 0) {
            const i = stack.length - 1;
            topY = baseY + i * stackStep + stackOffset(col, i).y;
        }
        entries.push({ node, topY, col });
    }
    entries.sort((a, b) => {
        if (Math.abs(a.topY - b.topY) > tieY) {
            return a.topY - b.topY;
        }
        return b.col - a.col;
    });
    for (let i = 0; i < entries.length; i++) {
        entries[i].node.setSiblingIndex(i);
    }
}

function rebuildColumnNodes(opts: Pick<RebuildBoardOptions, 'boardLayer' | 'metrics' | 'stackStep' | 'stackOffset' | 'logic' | 'onColumnTap'>): void {
    const { boardLayer, metrics, stackStep, stackOffset, logic, onColumnTap } = opts;
    const model = logic.getModel();
    const cols = model.getColumns();
    const { columnBaseY, spacing, startX } = metrics;
    const n = cols.length;

    for (let col = 0; col < n; col++) {
        const colNode = new Node(`col_${col}`);
        colNode.layer = Layers.Enum.UI_2D;
        const baseY = columnBaseY[col] ?? metrics.boardAnchorY;
        colNode.setPosition(startX + col * spacing, baseY, 0);
        boardLayer.addChild(colNode);
        const stack = cols[col];
        let topCard: Node | null = null;
        const playable = logic.canPlayColumn(col);
        for (let i = 0; i < stack.length; i++) {
            const c = stack[i];
            /** 明牌不加置灰蒙层，避免多张翻开时像被遮挡；可点性仍仅绑在列顶 */
            const sp = c.faceUp ? makeCardNode(c, false) : makeFaceDownCardNode();
            const offset = stackOffset(col, i);
            sp.setPosition(offset.x, i * stackStep + offset.y, 0);
            colNode.addChild(sp);
            topCard = sp;
        }
        if (topCard && playable) {
            const tappedTop = topCard;
            attachTap(topCard, () => onColumnTap(col, colNode, startX + col * spacing, tappedTop));
        }
    }
}

function rebuildHandAndStockNodes(
    handLayer: Node,
    handPos: Readonly<Vec3>,
    _stockPos: Readonly<Vec3>,
    labelStockCount: Label | null,
    logic: GameLogicManager,
    onStockTap: () => void,
    stockRowMaxCenterSpan: number,
): void {
    const model = logic.getModel();
    const stock = model.getStock();
    const stepX = faceDownRowStepX(stock.length, stockRowMaxCenterSpan);
    const rightBackCenterX = handPos.x - kCardWidth - kHandToCoverStockGap;

    let stockTapTarget: Node | null = null;
    for (let i = 0; i < stock.length; i++) {
        const back = makeFaceDownCardNode();
        const x = rightBackCenterX - (stock.length - 1 - i) * stepX;
        back.setPosition(x, handPos.y, 0);
        handLayer.addChild(back);
        back.setSiblingIndex(i);
        stockTapTarget = back;
    }
    if (stockTapTarget) {
        stockTapTarget.name = 'stockTap';
        const canDrawNow = logic.canDrawStockNow();
        if (!canDrawNow) {
            const op = stockTapTarget.addComponent(UIOpacity);
            op.opacity = 120;
        }
        attachTap(stockTapTarget, onStockTap);
    }

    const handNode = makeCardNode(model.getHandTop(), false);
    handNode.name = kHandTopNodeName;
    handNode.setPosition(handPos.x, handPos.y, 0);
    handLayer.addChild(handNode);
    handNode.setSiblingIndex(stock.length);

    if (labelStockCount) {
        labelStockCount.string = stock.length > 0 ? `盖牌 ${stock.length} 张` : '已耗尽';
    }
}

/**
 * 按模型清空并重建主牌列、手牌顶与盖牌行；会重绑列顶与 `stockTap` 点击。
 *
 * @param opts 布局、模型与回调
 */
export function rebuildBoardAndHandFromModel(opts: RebuildBoardOptions): void {
    const {
        boardLayer,
        handLayer,
        labelStockCount,
        handPos,
        stockPos,
        metrics,
        stackStep,
        stackOffset,
        logic,
        onColumnTap,
        onStockTap,
        stockRowMaxCenterSpan,
    } = opts;
    boardLayer.removeAllChildren();
    handLayer.removeAllChildren();
    rebuildColumnNodes({ boardLayer, metrics, stackStep, stackOffset, logic, onColumnTap });
    orderBoardColumnsByStackTop(boardLayer, logic.getModel().getColumns(), metrics.columnBaseY, stackStep, stackOffset);
    rebuildHandAndStockNodes(handLayer, handPos, stockPos, labelStockCount, logic, onStockTap, stockRowMaxCenterSpan);
}
