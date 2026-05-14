import { Color, Graphics, Label, Layers, Node, UITransform, Widget, Button } from 'cc';
import type { Layout } from 'cc';
import {
    kBottomPileCenterX,
    kGamePlayHudTopInsetY,
    kGamePlayHudTopStripHeight,
    kPileCaptionHalfWidth,
} from '../configs/DesignLayout';
import {
    kCoinHudGold,
    kTimerRelaxed,
} from '../configs/UiWarmPalette';
import { ccAdd, ccGet, kEngineLayoutHorizontalDirLtr, kEngineLayoutResizeModeNone, kEngineLayoutTypeHorizontal } from '../utils/CcEngineComponent';
import { relaxLabelDensity } from '../utils/LabelReadability';
import { buildCoinIconNode, startCoinIconIdleTween } from './CoinHudFx';
import type { RootBounds } from './GameViewBoardLayout';

/**
 * 对局 **单条顶栏 HUD**：金币、可选暂停、限时文案（Widget 顶对齐），避免中间条与牌层/Widget 纵向冲突导致计时不可见。
 */

export const kHudCoinBlockW = 320;
const kHudTimerGapX = 16;
const kHudStripRightInset = 28;
const kHudPauseBtnW = 88;
/**
 * 顶栏左右边距（勿使用 `hudRowLeftX + halfW`：那是为**底部**牌堆说明预留的左偏，用于顶栏会把条宽压到 ~400px，
 * 金币+暂停已占满宽度，计时 Label 会被挤成几十像素并在 SHRINK 下「消失」）。
 */
export const kHudTopBarPadLeft = 16;
/** 限时文案目标最小宽度；实际宽度会钳在条内剩余空间，避免超出条宽 */
const kHudTimerLabelMinW = 300;

/** 顶栏根节点名（金币 + 暂停 + 计时） */
export const kHudTopBarStripName = 'hudTopBarStrip';

export type HudTopBarStripOptions = {
    /** 点击「暂停」时触发 */
    onPause?: () => void;
};

export interface HudTopBarStripBuildResult {
    strip: Node;
    coinLabel: Label;
    timerLabel: Label;
}

function addPauseHudButton(strip: Node, onPause: () => void): void {
    const n = new Node('pauseHudBtn');
    n.layer = Layers.Enum.UI_2D;
    const ui = n.addComponent(UITransform);
    ui.setContentSize(kHudPauseBtnW, 40);
    ui.anchorX = 0;
    ui.anchorY = 0.5;
    const btn = n.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 1.05;
    const g = n.addComponent(Graphics);
    const rw = kHudPauseBtnW - 10;
    g.roundRect(0, -18, rw, 36, 8);
    g.fillColor = new Color(44, 52, 70, 220);
    g.fill();
    const child = new Node('lbl');
    child.layer = Layers.Enum.UI_2D;
    child.setPosition(rw * 0.5, 0, 0);
    child.addComponent(UITransform).setContentSize(rw - 4, 34);
    const lb = child.addComponent(Label);
    lb.string = '暂停';
    lb.fontSize = 22;
    lb.lineHeight = 30;
    lb.horizontalAlign = Label.HorizontalAlign.CENTER;
    lb.verticalAlign = Label.VerticalAlign.CENTER;
    lb.overflow = Label.Overflow.SHRINK;
    lb.color = kCoinHudGold;
    relaxLabelDensity(lb, 1);
    n.addChild(child);
    n.on(Button.EventType.CLICK, onPause);
    strip.addChild(n);
}

function addCoinBlock(strip: Node): Label {
    const coinNode = new Node('coinHud');
    coinNode.layer = Layers.Enum.UI_2D;
    const cui = coinNode.addComponent(UITransform);
    cui.setContentSize(kHudCoinBlockW, 44);
    cui.anchorX = 0;
    cui.anchorY = 0.5;
    const icon = buildCoinIconNode(34);
    icon.setPosition(22, 0, 0);
    coinNode.addChild(icon);
    startCoinIconIdleTween(icon);
    const textWrap = new Node('coinText');
    textWrap.layer = Layers.Enum.UI_2D;
    textWrap.setPosition(56, 0, 0);
    const twUi = textWrap.addComponent(UITransform);
    twUi.setContentSize(248, 36);
    twUi.anchorX = 0;
    twUi.anchorY = 0.5;
    const coinLb = textWrap.addComponent(Label);
    coinLb.fontSize = 23;
    coinLb.lineHeight = 34;
    coinLb.horizontalAlign = Label.HorizontalAlign.LEFT;
    coinLb.verticalAlign = Label.VerticalAlign.CENTER;
    coinLb.overflow = Label.Overflow.SHRINK;
    coinLb.color = kCoinHudGold;
    relaxLabelDensity(coinLb, 1);
    coinNode.addChild(textWrap);
    strip.addChild(coinNode);
    return coinLb;
}

function addTimerBlock(strip: Node): Label {
    const timerNode = new Node('levelTimer');
    timerNode.layer = Layers.Enum.UI_2D;
    const tui = timerNode.addComponent(UITransform);
    tui.setContentSize(320, 36);
    tui.anchorX = 0;
    tui.anchorY = 0.5;
    const timerLb = timerNode.addComponent(Label);
    timerLb.fontSize = 24;
    timerLb.lineHeight = 32;
    timerLb.horizontalAlign = Label.HorizontalAlign.LEFT;
    timerLb.verticalAlign = Label.VerticalAlign.CENTER;
    timerLb.overflow = Label.Overflow.SHRINK;
    timerLb.color = kTimerRelaxed;
    relaxLabelDensity(timerLb, 1);
    strip.addChild(timerNode);
    return timerLb;
}

/**
 * 与底牌说明区错开后的 HUD 行左缘 X（根局部）。
 *
 * @param bounds shell 宽度信息
 */
export function hudRowLeftX(bounds: { width: number }): number {
    const halfW = bounds.width * 0.5;
    const pastPileCaption = kBottomPileCenterX + kPileCaptionHalfWidth + 28;
    return Math.max(-halfW + 20, pastPileCaption);
}

/**
 * 构建对局顶栏（金币、暂停、限时）并挂到 `root`。
 */
export function createHudTopBarStrip(
    root: Node,
    _bounds: RootBounds,
    opts?: HudTopBarStripOptions,
): HudTopBarStripBuildResult {
    const strip = new Node(kHudTopBarStripName);
    strip.layer = Layers.Enum.UI_2D;
    strip.addComponent(UITransform).setContentSize(400, kGamePlayHudTopStripHeight);

    const ww = ccAdd<Widget>(strip, 'Widget');
    ww.isAlignLeft = true;
    ww.isAlignRight = true;
    ww.isAlignTop = true;
    ww.isAlignBottom = false;
    ww.left = kHudTopBarPadLeft;
    ww.right = kHudStripRightInset;
    ww.top = kGamePlayHudTopInsetY;
    ww.updateAlignment();

    const layout = ccAdd<Layout>(strip, 'Layout');
    layout.type = kEngineLayoutTypeHorizontal;
    layout.resizeMode = kEngineLayoutResizeModeNone;
    layout.spacingX = kHudTimerGapX;
    layout.horizontalDirection = kEngineLayoutHorizontalDirLtr;

    const coinLabel = addCoinBlock(strip);
    if (opts?.onPause) {
        addPauseHudButton(strip, opts.onPause);
    }
    const timerLabel = addTimerBlock(strip);
    root.addChild(strip);
    return { strip, coinLabel, timerLabel };
}

/** 同步顶栏 Widget，并按剩余横向空间设置计时 {@link Label} 宽度（不超出条宽）。 */
export function layoutHudTopBarStrip(strip: Node, _bounds: RootBounds): void {
    if (!strip.isValid) {
        return;
    }
    const ww = ccGet<Widget>(strip, 'Widget');
    if (ww) {
        ww.isAlignTop = true;
        ww.isAlignBottom = false;
        ww.left = kHudTopBarPadLeft;
        ww.right = kHudStripRightInset;
        ww.top = kGamePlayHudTopInsetY;
        ww.updateAlignment();
    }
    const stripUi = ccGet<UITransform>(strip, 'UITransform');
    const timerNode = strip.getChildByName('levelTimer');
    const tui = timerNode ? ccGet<UITransform>(timerNode, 'UITransform') : null;
    if (stripUi && tui) {
        let reserved = kHudCoinBlockW + kHudTimerGapX;
        if (strip.getChildByName('pauseHudBtn')) {
            reserved += kHudPauseBtnW + kHudTimerGapX;
        }
        const inner = stripUi.width - reserved;
        const fromLayout = inner > 8 ? inner : Math.floor(stripUi.width * 0.35);
        const tw = Math.min(Math.max(kHudTimerLabelMinW, fromLayout), Math.max(inner, 48));
        tui.setContentSize(tw, 36);
    }
    ccGet<Layout>(strip, 'Layout')?.updateLayout();
}
