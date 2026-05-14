import { Button, Graphics, Label, Layers, Node, UITransform, Widget } from 'cc';
import { kDesignHeight, kDesignWidth } from '../configs/DesignLayout';
import { kPearlOnColor } from '../configs/UiWarmPalette';
import { relaxLabelDensity } from '../utils/LabelReadability';
import { ccGet } from '../utils/CcEngineComponent';
import { buildCoinIconNode, startCoinIconIdleTween } from './CoinHudFx';
import {
    kSelectBg,
    kSelectCoinAccent,
    kSelectShopButtonFill,
    kSelectSubText,
    kSelectTitleText,
    kSelectToastWarn,
} from './LevelSelectPalette';

export type LevelSelectChromeLabels = {
    /** 顶栏「金币 N」主数字标签 */
    coinValueLabel: Label;
    /** 底部提示 / 错误文案 */
    toastLabel: Label;
};

function addSelectBackground(root: Node, rw: number, rh: number): void {
    const bg = new Node('bg');
    bg.layer = Layers.Enum.UI_2D;
    bg.addComponent(UITransform).setContentSize(rw, rh);
    const g = bg.addComponent(Graphics);
    g.rect(-rw * 0.5, -rh * 0.5, rw, rh);
    g.fillColor = kSelectBg;
    g.fill();
    root.addChild(bg);
}

function addSelectTitle(root: Node, titleTop: number): void {
    const title = new Node('title');
    title.layer = Layers.Enum.UI_2D;
    title.addComponent(UITransform).setContentSize(780, 152);
    const titleWidget = title.addComponent(Widget);
    titleWidget.isAlignTop = true;
    titleWidget.isAlignHorizontalCenter = true;
    titleWidget.top = titleTop;
    titleWidget.horizontalCenter = 0;
    const tl = title.addComponent(Label);
    tl.string = '选关';
    tl.fontSize = 74;
    tl.lineHeight = 102;
    tl.color = kSelectTitleText;
    root.addChild(title);
}

function createCoinValueRow(coinBarW: number): { row: Node; valueLabel: Label } {
    const coinRow = new Node('coinRow');
    coinRow.layer = Layers.Enum.UI_2D;
    coinRow.setPosition(0, 14, 0);
    const rowInnerW = Math.min(420, coinBarW - 48);
    coinRow.addComponent(UITransform).setContentSize(rowInnerW, 52);

    const coinIc = buildCoinIconNode(50);
    coinIc.setPosition(-rowInnerW * 0.5 + 40, 0, 0);
    coinRow.addChild(coinIc);
    startCoinIconIdleTween(coinIc);

    const coinLine1 = new Node('coinLine1');
    coinLine1.layer = Layers.Enum.UI_2D;
    coinLine1.setPosition(-rowInnerW * 0.5 + 78, 0, 0);
    const clbTr = coinLine1.addComponent(UITransform);
    clbTr.setContentSize(rowInnerW - 80, 40);
    clbTr.anchorX = 0;
    clbTr.anchorY = 0.5;
    const clb = coinLine1.addComponent(Label);
    clb.fontSize = 40;
    clb.lineHeight = 52;
    clb.horizontalAlign = Label.HorizontalAlign.LEFT;
    clb.verticalAlign = Label.VerticalAlign.CENTER;
    clb.overflow = Label.Overflow.SHRINK;
    clb.color = kSelectCoinAccent;
    relaxLabelDensity(clb, 1);
    coinRow.addChild(coinLine1);
    return { row: coinRow, valueLabel: clb };
}

function createHintLineUnderCoinRow(coinBarW: number): Node {
    const coinLine2 = new Node('coinLine2');
    coinLine2.layer = Layers.Enum.UI_2D;
    coinLine2.addComponent(UITransform).setContentSize(coinBarW - 180, 58);
    coinLine2.setPosition(0, -30, 0);
    const clb2 = coinLine2.addComponent(Label);
    clb2.string = '沿路线点击圆点选关；金色圆点可金币解锁；右上道具商店购库存';
    clb2.fontSize = 24;
    clb2.lineHeight = 34;
    clb2.horizontalAlign = Label.HorizontalAlign.CENTER;
    clb2.verticalAlign = Label.VerticalAlign.CENTER;
    clb2.overflow = Label.Overflow.SHRINK;
    clb2.enableWrapText = true;
    clb2.color = kSelectSubText;
    relaxLabelDensity(clb2, 1);
    return coinLine2;
}

function createShopEntryButton(onShopClick: () => void): Node {
    const shopEntry = new Node('shopEntry');
    shopEntry.layer = Layers.Enum.UI_2D;
    shopEntry.addComponent(UITransform).setContentSize(188, 54);
    const shopWg = shopEntry.addComponent(Widget);
    shopWg.isAlignTop = true;
    shopWg.isAlignRight = true;
    shopWg.top = 6;
    shopWg.right = 8;
    const sb = shopEntry.addComponent(Button);
    sb.transition = Button.Transition.SCALE;
    sb.zoomScale = 1.06;
    const sg = shopEntry.addComponent(Graphics);
    sg.roundRect(-88, -25, 176, 50, 14);
    sg.fillColor = kSelectShopButtonFill;
    sg.fill();
    const slN = new Node('sl');
    slN.layer = Layers.Enum.UI_2D;
    slN.addComponent(UITransform).setContentSize(168, 46);
    const slb = slN.addComponent(Label);
    slb.string = '道具商店';
    slb.fontSize = 28;
    slb.lineHeight = 36;
    slb.color = kPearlOnColor;
    shopEntry.addChild(slN);
    shopEntry.on(Button.EventType.CLICK, onShopClick);
    return shopEntry;
}

function addCoinBarSection(
    root: Node,
    rw: number,
    titleTop: number,
    onShopClick: () => void,
): Label {
    const coinBar = new Node('coinBar');
    coinBar.layer = Layers.Enum.UI_2D;
    const coinBarW = Math.min(1020, rw * 0.94);
    coinBar.addComponent(UITransform).setContentSize(coinBarW, 118);
    const coinW = coinBar.addComponent(Widget);
    coinW.isAlignTop = true;
    coinW.isAlignHorizontalCenter = true;
    coinW.top = titleTop + 118;
    coinW.horizontalCenter = 0;

    const { row, valueLabel } = createCoinValueRow(coinBarW);
    coinBar.addChild(row);
    coinBar.addChild(createHintLineUnderCoinRow(coinBarW));
    coinBar.addChild(createShopEntryButton(onShopClick));
    root.addChild(coinBar);
    return valueLabel;
}

function addToastStrip(root: Node, rw: number, rh: number): Label {
    const toast = new Node('toast');
    toast.layer = Layers.Enum.UI_2D;
    toast.addComponent(UITransform).setContentSize(Math.min(1000, rw * 0.92), 64);
    const tw = toast.addComponent(Widget);
    tw.isAlignBottom = true;
    tw.isAlignHorizontalCenter = true;
    tw.bottom = Math.round(Math.max(48, rh * 0.04));
    tw.horizontalCenter = 0;
    const tol = toast.addComponent(Label);
    tol.fontSize = 30;
    tol.lineHeight = 40;
    tol.horizontalAlign = Label.HorizontalAlign.CENTER;
    tol.overflow = Label.Overflow.SHRINK;
    tol.color = kSelectToastWarn;
    tol.string = '';
    root.addChild(toast);
    return tol;
}

/**
 * 构建选关大厅静态 Chrome：全屏背景、标题、「选关」文案、金币条、道具商店入口与底部 Toast 区。
 *
 * 职责：纯 UI 节点搭建；不读存档、不绑定关卡数据。调用方在挂载后自行 `refreshCoinBar` 等。
 *
 * @param root 全屏 shell 根节点
 * @param onShopClick 点击「道具商店」时触发
 * @returns 需要持续更新的 Label 引用
 */
export function attachLevelSelectChrome(root: Node, onShopClick: () => void): LevelSelectChromeLabels {
    const rootUi = ccGet<UITransform>(root, 'UITransform');
    const rw = rootUi?.width ?? kDesignWidth;
    const rh = rootUi?.height ?? kDesignHeight;

    addSelectBackground(root, rw, rh);
    const titleTop = Math.round(Math.min(220, Math.max(76, rh * 0.078)));
    addSelectTitle(root, titleTop);
    const coinValueLabel = addCoinBarSection(root, rw, titleTop, onShopClick);
    const toastLabel = addToastStrip(root, rw, rh);
    return { coinValueLabel, toastLabel };
}