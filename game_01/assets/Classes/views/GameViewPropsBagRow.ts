import { Button, Color, Graphics, Label, Layers, Node, Sprite, UITransform } from 'cc';
import { kPropsBagRowHeight, kPropsBagRowWidth } from '../configs/DesignLayout';
import { kPropCaptionGreen } from '../configs/UiWarmPalette';
import { relaxLabelDensity } from '../utils/LabelReadability';
import { applyRemoteUrlToSprite } from '../utils/RemoteSpriteUtil';

function createBagButtonChrome(): Node {
    const bagBtn = new Node('bagBtn');
    bagBtn.layer = Layers.Enum.UI_2D;
    bagBtn.setPosition(0, 0, 0);
    bagBtn.addComponent(UITransform).setContentSize(200, 68);
    const bb = bagBtn.addComponent(Button);
    bb.transition = Button.Transition.SCALE;
    bb.zoomScale = 1.05;
    const bg = bagBtn.addComponent(Graphics);
    bg.roundRect(-92, -32, 184, 64, 16);
    bg.fillColor = new Color(46, 62, 54, 242);
    bg.fill();
    bg.roundRect(-92, -32, 184, 64, 16);
    bg.strokeColor = new Color(200, 210, 130, 90);
    bg.lineWidth = 2;
    bg.stroke();
    return bagBtn;
}

function addGiftIconToBagButton(bagBtn: Node): void {
    const ic = new Node('icon');
    ic.layer = Layers.Enum.UI_2D;
    ic.setPosition(-52, 2, 0);
    ic.addComponent(UITransform).setContentSize(40, 40);
    const spr = ic.addComponent(Sprite);
    spr.sizeMode = Sprite.SizeMode.CUSTOM;
    bagBtn.addChild(ic);
    applyRemoteUrlToSprite(spr, 'https://img.icons8.com/fluency/96/gift.png');
}

function addBagTextLabels(bagBtn: Node): void {
    const cap = new Node('cap');
    cap.layer = Layers.Enum.UI_2D;
    cap.setPosition(28, 4, 0);
    cap.addComponent(UITransform).setContentSize(120, 28);
    const capLb = cap.addComponent(Label);
    capLb.string = '道具包裹';
    capLb.fontSize = 24;
    capLb.lineHeight = 32;
    capLb.verticalAlign = Label.VerticalAlign.CENTER;
    capLb.overflow = Label.Overflow.SHRINK;
    capLb.color = kPropCaptionGreen;
    relaxLabelDensity(capLb, 1);
    bagBtn.addChild(cap);

    const sub = new Node('sub');
    sub.layer = Layers.Enum.UI_2D;
    sub.setPosition(28, -20, 0);
    sub.addComponent(UITransform).setContentSize(140, 26);
    const slb = sub.addComponent(Label);
    slb.string = '点此选择';
    slb.fontSize = 18;
    slb.lineHeight = 26;
    slb.verticalAlign = Label.VerticalAlign.CENTER;
    slb.overflow = Label.Overflow.SHRINK;
    slb.color = new Color(255, 228, 140, 255);
    relaxLabelDensity(slb, 1);
    bagBtn.addChild(sub);
}

function buildPropsBagButton(onBagClick: () => void): Node {
    const bagBtn = createBagButtonChrome();
    addGiftIconToBagButton(bagBtn);
    addBagTextLabels(bagBtn);
    bagBtn.on(Button.EventType.CLICK, onBagClick);
    return bagBtn;
}

/** 主牌区下方「道具包裹」入口行（默认靠左，落在堆牌区，避免压在主牌列与底牌堆中心）。 */
export function attachPropsBagRow(root: Node, x: number, y: number, onBagClick: () => void): void {
    const row = new Node('propsHud');
    row.layer = Layers.Enum.UI_2D;
    row.setPosition(x, y, 0);
    row.addComponent(UITransform).setContentSize(kPropsBagRowWidth, kPropsBagRowHeight);
    row.addChild(buildPropsBagButton(onBagClick));
    root.addChild(row);
}
