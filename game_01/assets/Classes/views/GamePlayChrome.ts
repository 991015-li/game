import { Color, Graphics, Label, Layers, Node, UITransform, Button, Vec3 } from 'cc';
import { kOnDarkButton, kParchment, kParchmentHint, kParchmentSoft } from '../configs/UiWarmPalette';
import { kBottomPileCenterX, kGamePlayHudTopBandReserveY, kMainPileTitleHeight } from '../configs/DesignLayout';
import { kCardHeight, kCardWidth } from './CardViewFactory';
import { relaxLabelDensity } from '../utils/LabelReadability';

/** 全屏底层毡色桌布（提高明度、略偏暖青绿，避免过深的赌场绿） */
const kTableFeltBase = new Color(72, 138, 112, 255);
/** 堆牌区：比底层稍深一线，保持分区感 */
const kTableFeltHandZone = new Color(62, 124, 100, 255);
/** 主牌区：更亮一档，视觉焦点在上半桌 */
const kTableFeltBoardZone = new Color(92, 164, 134, 255);
/** 桌缘压线：柔和深青，不再用近黑色描边 */
const kTableFeltRim = new Color(52, 102, 82, 255);

type ShellBounds = { width: number; height: number; left: number; bottom: number };

/**
 * 对局界面静态装饰层：全屏桌布、分区色带、主区标题、底部单牌堆说明与张数、操作按钮与牌层容器。
 * 不含玩法规则长文案、不持有对局数据。导出 {@link buildGamePlayChrome} 供 {@link GameView} 调用。
 */

/** {@link buildGamePlayChrome} 返回值：后续刷新牌面时所需的层与锚点 */
export interface GamePlayChromeResult {
    /** 主牌列父节点 */
    boardLayer: Node;
    /** 底牌与备用堆层 */
    handLayer: Node;
    labelStockCount: Label;
    /** 底牌堆锚点（顶牌中心） */
    handPos: Vec3;
    /** 与 handPos 同值或分堆时的备用堆锚点 */
    stockPos: Vec3;
}

export interface GamePlayChromeCallbacks {
    /** 点击「回退」 */
    onUndo: () => void;
    /** 点击「恢复开局」：整局回到进入关卡时的牌面 */
    onResetToStart: () => void;
    /** 点击「选关」 */
    onMenu: () => void;
}

function mountTableCloth(root: Node, bounds: ShellBounds): void {
    const tableCloth = new Node('tableCloth');
    tableCloth.layer = Layers.Enum.UI_2D;
    tableCloth.setPosition(0, 0, 0);
    tableCloth.addComponent(UITransform).setContentSize(bounds.width, bounds.height);
    const gCloth = tableCloth.addComponent(Graphics);
    const halfW = bounds.width * 0.5;
    const halfH = bounds.height * 0.5;
    gCloth.rect(-halfW, -halfH, bounds.width, bounds.height);
    gCloth.fillColor = kTableFeltBase;
    gCloth.fill();
    const inset = 6;
    gCloth.roundRect(-halfW + inset, -halfH + inset, bounds.width - inset * 2, bounds.height - inset * 2, 16);
    gCloth.strokeColor = kTableFeltRim;
    gCloth.lineWidth = 5;
    gCloth.stroke();
    root.insertChild(tableCloth, 0);
}

function mountZoneBands(root: Node, bounds: ShellBounds, handH: number, boardH: number): { handZoneBottom: number; boardZoneTop: number } {
    const handZoneBottom = bounds.bottom;
    const handZoneTop = bounds.bottom + handH;
    const bandP = new Node('bandP');
    bandP.layer = Layers.Enum.UI_2D;
    bandP.addComponent(UITransform).setContentSize(bounds.width, handH);
    bandP.setPosition(0, (handZoneBottom + handZoneTop) * 0.5, 0);
    const gp = bandP.addComponent(Graphics);
    gp.rect(-bounds.width * 0.5, -handH * 0.5, bounds.width, handH);
    gp.fillColor = kTableFeltHandZone;
    gp.fill();
    root.addChild(bandP);

    const boardZoneBottom = handZoneTop;
    const boardZoneTop = boardZoneBottom + boardH;
    const bandB = new Node('bandB');
    bandB.layer = Layers.Enum.UI_2D;
    bandB.addComponent(UITransform).setContentSize(bounds.width, boardH);
    bandB.setPosition(0, (boardZoneBottom + boardZoneTop) * 0.5, 0);
    const gb = bandB.addComponent(Graphics);
    gb.rect(-bounds.width * 0.5, -boardH * 0.5, bounds.width, boardH);
    gb.fillColor = kTableFeltBoardZone;
    gb.fill();
    root.addChild(bandB);
    return { handZoneBottom, boardZoneTop };
}

function mountBoardHandLayers(root: Node): { boardLayer: Node; handLayer: Node } {
    const boardLayer = new Node('board');
    boardLayer.layer = Layers.Enum.UI_2D;
    root.addChild(boardLayer);
    const handLayer = new Node('hand');
    handLayer.layer = Layers.Enum.UI_2D;
    root.addChild(handLayer);
    return { boardLayer, handLayer };
}

function pilePositions(bounds: ShellBounds, handH: number): { handPos: Vec3; stockPos: Vec3 } {
    const y = bounds.bottom + handH * 0.5;
    const p = new Vec3(kBottomPileCenterX, y, 0);
    return { handPos: p, stockPos: p.clone() };
}

function addMainPileTitle(root: Node, boardZoneTop: number): void {
    const mainPileTitle = new Node('mainPileTitle');
    mainPileTitle.layer = Layers.Enum.UI_2D;
    mainPileTitle.setPosition(0, boardZoneTop - kGamePlayHudTopBandReserveY, 0);
    mainPileTitle.addComponent(UITransform).setContentSize(420, kMainPileTitleHeight);
    const mainPileTitleLb = mainPileTitle.addComponent(Label);
    mainPileTitleLb.string = '主牌堆';
    mainPileTitleLb.fontSize = 32;
    mainPileTitleLb.lineHeight = 40;
    mainPileTitleLb.overflow = Label.Overflow.SHRINK;
    mainPileTitleLb.color = kParchment;
    relaxLabelDensity(mainPileTitleLb, 1);
    root.addChild(mainPileTitle);
}

function addBottomPileCaption(root: Node, pilePos: Vec3): void {
    const cap = new Node('pileCaption');
    cap.layer = Layers.Enum.UI_2D;
    cap.setPosition(pilePos.x, pilePos.y + kCardHeight * 0.5 + 30, 0);
    cap.addComponent(UITransform).setContentSize(200, 40);
    const lb = cap.addComponent(Label);
    lb.string = '牌堆';
    lb.fontSize = 28;
    lb.lineHeight = 36;
    lb.horizontalAlign = Label.HorizontalAlign.CENTER;
    lb.overflow = Label.Overflow.SHRINK;
    lb.color = kParchmentSoft;
    relaxLabelDensity(lb, 1);
    root.addChild(cap);
}

function addStockCountLabel(root: Node, pilePos: Vec3): Label {
    const stockCountNode = new Node('stockCount');
    stockCountNode.layer = Layers.Enum.UI_2D;
    stockCountNode.setPosition(pilePos.x + kCardWidth * 0.5 + 88, pilePos.y - 6, 0);
    stockCountNode.addComponent(UITransform).setContentSize(200, 36);
    const labelStockCount = stockCountNode.addComponent(Label);
    labelStockCount.fontSize = 22;
    labelStockCount.lineHeight = 30;
    labelStockCount.overflow = Label.Overflow.SHRINK;
    labelStockCount.color = kParchmentHint;
    relaxLabelDensity(labelStockCount, 1);
    root.addChild(stockCountNode);
    return labelStockCount;
}

/**
 * 文案在牌层之后入树（同父节点下后绘制 = 更靠前），避免主牌/底牌叠在字上；
 * Label 无 Button，一般不会截获牌区的触摸（标题与牌列在 Y 向上也已错开）。
 */
function mountPileChromeLabels(root: Node, boardZoneTop: number, handPos: Vec3, stockPos: Vec3): Label {
    addMainPileTitle(root, boardZoneTop);
    addBottomPileCaption(root, handPos);
    return addStockCountLabel(root, handPos);
}

/** 底栏三键的 Y 与中间键宽度（单牌堆时中间钮置于堆下方居中）。 */
function resolveBottomButtonLayout(
    bounds: ShellBounds,
    handZoneBottom: number,
    handH: number,
    handPos: Vec3,
    stockPos: Vec3,
): { btnRowY: number; centerBtnW: number; xMenu: number; xUndo: number; xReset: number } {
    const handCy = handZoneBottom + handH * 0.5;
    const samePile = Math.abs(handPos.x - stockPos.x) < 1 && Math.abs(handPos.y - stockPos.y) < 1;
    const pileDepthReserve = 0;
    const cardBottomY = handCy - kCardHeight * 0.5 - (samePile ? pileDepthReserve : 0);
    const stockCountCenterY = handPos.y - 6;
    const stockCountHalfH = 18;
    const lowestHandUiY = Math.min(cardBottomY, stockCountCenterY - stockCountHalfH);
    const gapBelow = 16;
    const btnHalfVis = 26;
    const rawBtnY = lowestHandUiY - gapBelow - btnHalfVis;
    const minBtnY = handZoneBottom + btnHalfVis + 14;
    const maxBtnY = cardBottomY - 10 - btnHalfVis;
    let btnRowY = rawBtnY;
    if (minBtnY <= maxBtnY) {
        btnRowY = Math.max(minBtnY, Math.min(maxBtnY, rawBtnY));
    } else {
        btnRowY = Math.max(minBtnY, Math.min(handCy - btnHalfVis - 20, rawBtnY));
    }
    let centerBtnW = 196;
    let xReset = handPos.x;
    if (!samePile) {
        const pileHalfW = kCardWidth * 0.5;
        const pileGapInner = handPos.x - pileHalfW - (stockPos.x + pileHalfW);
        centerBtnW = Math.max(160, Math.min(196, Math.floor(pileGapInner - 4)));
        xReset = (handPos.x + stockPos.x) * 0.5;
    }
    const sideInset = Math.max(bounds.width * 0.06, 56);
    const sideHalf = 94;
    const xMenu = bounds.left + sideInset + sideHalf;
    const xUndo = bounds.left + bounds.width - sideInset - sideHalf;
    return { btnRowY, centerBtnW, xMenu, xUndo, xReset };
}

function addBottomActionButtons(
    root: Node,
    cb: GamePlayChromeCallbacks,
    layout: { btnRowY: number; centerBtnW: number; xMenu: number; xUndo: number; xReset: number },
): void {
    const { btnRowY, centerBtnW, xMenu, xUndo, xReset } = layout;
    addTextButton(root, '选关', xMenu, btnRowY, cb.onMenu, 188);
    addTextButton(root, '恢复开局', xReset, btnRowY, cb.onResetToStart, centerBtnW, 26);
    addTextButton(root, '回退', xUndo, btnRowY, cb.onUndo, 188);
}

/**
 * 构建对局主界面装饰与分层节点。
 * @param root shell 根节点
 * @param bounds `left/bottom/width/height` 与设计分辨率一致的外接矩形
 * @param handH 堆牌区高度（已按画布缩放）
 * @param boardH 主牌区高度（已按画布缩放）
 * @param cb 底部按钮回调
 */
export function buildGamePlayChrome(
    root: Node,
    bounds: ShellBounds,
    handH: number,
    boardH: number,
    cb: GamePlayChromeCallbacks
): GamePlayChromeResult {
    mountTableCloth(root, bounds);
    const { handZoneBottom, boardZoneTop } = mountZoneBands(root, bounds, handH, boardH);
    const { boardLayer, handLayer } = mountBoardHandLayers(root);
    const { handPos, stockPos } = pilePositions(bounds, handH);
    const labelStockCount = mountPileChromeLabels(root, boardZoneTop, handPos, stockPos);
    const btnLayout = resolveBottomButtonLayout(bounds, handZoneBottom, handH, handPos, stockPos);
    addBottomActionButtons(root, cb, btnLayout);
    return { boardLayer, handLayer, labelStockCount, handPos, stockPos };
}

function addTextButton(
    root: Node,
    text: string,
    x: number,
    y: number,
    fn: () => void,
    buttonWidth = 196,
    fontSize = 30
): void {
    const n = new Node(text);
    n.layer = Layers.Enum.UI_2D;
    n.setPosition(x, y, 0);
    n.addComponent(UITransform).setContentSize(buttonWidth, 62);
    const btn = n.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    const g = n.addComponent(Graphics);
    const rw = buttonWidth - 28;
    const rx = -rw * 0.5;
    g.roundRect(rx, -26, rw, 52, 10);
    g.fillColor = new Color(44, 52, 70, 235);
    g.fill();
    const child = new Node('lbl');
    child.layer = Layers.Enum.UI_2D;
    child.addComponent(UITransform).setContentSize(rw - 4, 50);
    const lb = child.addComponent(Label);
    lb.string = text;
    lb.fontSize = fontSize;
    lb.lineHeight = Math.ceil(fontSize * 1.25);
    lb.horizontalAlign = Label.HorizontalAlign.CENTER;
    lb.verticalAlign = Label.VerticalAlign.CENTER;
    lb.overflow = Label.Overflow.SHRINK;
    lb.color = kOnDarkButton;
    relaxLabelDensity(lb, 1);
    n.addChild(child);
    n.on(Button.EventType.CLICK, fn);
    root.addChild(n);
}
