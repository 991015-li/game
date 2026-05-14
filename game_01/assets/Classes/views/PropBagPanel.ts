import { Button, Color, Graphics, Label, Layers, Node, Sprite, UITransform, UIOpacity, Vec3, tween, easing } from 'cc';
import { kPearlOnColor, kPanelBodyMuted } from '../configs/UiWarmPalette';
import { relaxLabelDensity } from '../utils/LabelReadability';
import { applyRemoteUrlToSprite } from '../utils/RemoteSpriteUtil';

/**
 * 对局内道具包裹浮层：遮罩、五行说明与「使用」按钮（纯 UI，规则在 {@link GameViewPropRuntime}）。
 */

const kBagGiftIconUrl = 'https://img.icons8.com/fluency/96/gift.png';

/**
 * 包裹面板单行说明文案（与 `attachPropBagPanel` 内顺序一致）。
 */
export type PropBagRowTexts = {
    hint: string;
    time: string;
    smallTime: string;
    revealTop: string;
    shuffleStock: string;
};

export type PropBagPanelApi = {
    /** 根遮罩节点，供调整层级 */
    overlay: Node;
    /** 更新五行说明（剩余次数 / 扣金价） */
    setRowTexts: (t: PropBagRowTexts) => void;
    /** 淡出后销毁遮罩 */
    destroy: () => void;
};

function mountPropBagOverlay(
    parent: Node,
    bounds: { width: number; height: number; left: number; bottom: number }
): { overlay: Node; ovOp: UIOpacity } {
    const overlay = new Node('propBagOverlay');
    overlay.layer = Layers.Enum.UI_2D;
    overlay.addComponent(UITransform).setContentSize(bounds.width, bounds.height);
    const og = overlay.addComponent(Graphics);
    og.rect(bounds.left, bounds.bottom, bounds.width, bounds.height);
    og.fillColor = new Color(12, 18, 22, 170);
    og.fill();
    const ovOp = overlay.addComponent(UIOpacity);
    ovOp.opacity = 0;
    parent.addChild(overlay);
    tween(ovOp).to(0.18, { opacity: 255 }).start();
    return { overlay, ovOp };
}

function buildPropBagPanelShell(): Node {
    const panel = new Node('propBagPanel');
    panel.layer = Layers.Enum.UI_2D;
    panel.addComponent(UITransform).setContentSize(560, 520);
    const pg = panel.addComponent(Graphics);
    pg.roundRect(-280, -260, 560, 520, 20);
    pg.fillColor = new Color(42, 52, 48, 252);
    pg.fill();
    pg.roundRect(-280, -260, 560, 520, 20);
    pg.strokeColor = new Color(200, 190, 170, 140);
    pg.lineWidth = 2;
    pg.stroke();
    return panel;
}

function addPropBagTitleGiftAndTip(panel: Node): void {
    const titleN = new Node('title');
    titleN.layer = Layers.Enum.UI_2D;
    titleN.setPosition(0, 212, 0);
    titleN.addComponent(UITransform).setContentSize(480, 44);
    const titleL = titleN.addComponent(Label);
    titleL.string = '道具包裹';
    titleL.fontSize = 36;
    titleL.lineHeight = 44;
    titleL.color = kPearlOnColor;
    relaxLabelDensity(titleL, 1);
    panel.addChild(titleN);

    const iconN = new Node('gift');
    iconN.layer = Layers.Enum.UI_2D;
    iconN.setPosition(-230, 212, 0);
    iconN.addComponent(UITransform).setContentSize(40, 40);
    const spr = iconN.addComponent(Sprite);
    spr.sizeMode = Sprite.SizeMode.CUSTOM;
    panel.addChild(iconN);
    applyRemoteUrlToSprite(spr, kBagGiftIconUrl);

    const tipN = new Node('tip');
    tipN.layer = Layers.Enum.UI_2D;
    tipN.setPosition(0, 168, 0);
    tipN.addComponent(UITransform).setContentSize(520, 36);
    const tipL = tipN.addComponent(Label);
    tipL.string = '点「使用」消耗一次；免费 → 库存 → 当场扣金';
    tipL.fontSize = 20;
    tipL.lineHeight = 30;
    tipL.horizontalAlign = Label.HorizontalAlign.CENTER;
    tipL.overflow = Label.Overflow.SHRINK;
    tipL.color = kPanelBodyMuted;
    relaxLabelDensity(tipL, 1);
    panel.addChild(tipN);
}

function addPropBagCloseButton(panel: Node, onClose: () => void): void {
    const closeN = new Node('close');
    closeN.layer = Layers.Enum.UI_2D;
    closeN.setPosition(248, 224, 0);
    closeN.addComponent(UITransform).setContentSize(56, 44);
    const cb = closeN.addComponent(Button);
    cb.transition = Button.Transition.SCALE;
    cb.zoomScale = 1.08;
    const cg = closeN.addComponent(Graphics);
    cg.roundRect(-26, -18, 52, 36, 8);
    cg.fillColor = new Color(70, 90, 82, 230);
    cg.fill();
    const cl = new Node('cl');
    cl.layer = Layers.Enum.UI_2D;
    cl.addComponent(UITransform).setContentSize(48, 36);
    const clb = cl.addComponent(Label);
    clb.string = '✕';
    clb.fontSize = 28;
    clb.color = kPearlOnColor;
    closeN.addChild(cl);
    closeN.on(Button.EventType.CLICK, onClose);
    panel.addChild(closeN);
}

function addPropBagPanelHeader(panel: Node, onClose: () => void): void {
    addPropBagTitleGiftAndTip(panel);
    addPropBagCloseButton(panel, onClose);
}

function propBagRowWrap(name: string, y: number): Node {
    const wrap = new Node(name);
    wrap.layer = Layers.Enum.UI_2D;
    wrap.setPosition(0, y, 0);
    wrap.addComponent(UITransform).setContentSize(500, 64);
    const rowG = wrap.addComponent(Graphics);
    rowG.roundRect(-250, -30, 500, 60, 12);
    rowG.fillColor = new Color(32, 48, 42, 220);
    rowG.fill();
    return wrap;
}

function propBagRowTitle(wrap: Node, name: string): void {
    const titleRow = new Node('rowTitle');
    titleRow.layer = Layers.Enum.UI_2D;
    titleRow.setPosition(-40, 20, 0);
    titleRow.addComponent(UITransform).setContentSize(200, 30);
    const tl = titleRow.addComponent(Label);
    tl.string = name;
    tl.fontSize = 24;
    tl.lineHeight = 32;
    tl.horizontalAlign = Label.HorizontalAlign.LEFT;
    tl.verticalAlign = Label.VerticalAlign.CENTER;
    tl.overflow = Label.Overflow.SHRINK;
    tl.color = new Color(255, 235, 210, 255);
    relaxLabelDensity(tl, 1);
    wrap.addChild(titleRow);
}

function propBagRowSubLabel(wrap: Node): Label {
    const sn = new Node('sub');
    sn.layer = Layers.Enum.UI_2D;
    sn.setPosition(-40, -18, 0);
    sn.addComponent(UITransform).setContentSize(340, 40);
    const sl = sn.addComponent(Label);
    sl.fontSize = 19;
    sl.lineHeight = 28;
    sl.horizontalAlign = Label.HorizontalAlign.LEFT;
    sl.verticalAlign = Label.VerticalAlign.TOP;
    sl.overflow = Label.Overflow.SHRINK;
    sl.color = new Color(228, 216, 200, 255);
    relaxLabelDensity(sl, 1);
    wrap.addChild(sn);
    return sl;
}

function propBagRowUseButton(wrap: Node, onUse: () => void): void {
    const useN = new Node('use');
    useN.layer = Layers.Enum.UI_2D;
    useN.setPosition(200, 0, 0);
    useN.addComponent(UITransform).setContentSize(100, 40);
    const ub = useN.addComponent(Button);
    ub.transition = Button.Transition.SCALE;
    ub.zoomScale = 1.06;
    const ug = useN.addComponent(Graphics);
    ug.roundRect(-46, -18, 92, 36, 10);
    ug.fillColor = new Color(88, 148, 118, 255);
    ug.fill();
    const ulN = new Node('ul');
    ulN.layer = Layers.Enum.UI_2D;
    ulN.addComponent(UITransform).setContentSize(88, 32);
    const ul = ulN.addComponent(Label);
    ul.string = '使用';
    ul.fontSize = 22;
    ul.lineHeight = 30;
    ul.horizontalAlign = Label.HorizontalAlign.CENTER;
    ul.verticalAlign = Label.VerticalAlign.CENTER;
    ul.overflow = Label.Overflow.SHRINK;
    ul.color = kPearlOnColor;
    relaxLabelDensity(ul, 1);
    useN.addChild(ulN);
    useN.on(Button.EventType.CLICK, onUse);
    wrap.addChild(useN);
}

function addPropBagOptionRow(panel: Node, y: number, name: string, onUse: () => void, subLabels: Label[]): void {
    const wrap = propBagRowWrap(name, y);
    propBagRowTitle(wrap, name);
    subLabels.push(propBagRowSubLabel(wrap));
    propBagRowUseButton(wrap, onUse);
    panel.addChild(wrap);
}

function makePropBagPanelApi(overlay: Node, ovOp: UIOpacity, subLabels: Label[]): PropBagPanelApi {
    return {
        overlay,
        setRowTexts: (t: PropBagRowTexts) => {
            const arr = [t.hint, t.time, t.smallTime, t.revealTop, t.shuffleStock];
            for (let i = 0; i < subLabels.length && i < arr.length; i++) {
                subLabels[i].string = arr[i];
            }
        },
        destroy: () => {
            if (overlay.isValid) {
                tween(ovOp)
                    .to(0.12, { opacity: 0 })
                    .call(() => overlay.destroy())
                    .start();
            }
        },
    };
}

/**
 * 对局内「道具包裹」全屏浮层：五行道具与「使用」回调。
 *
 * @param parent shell
 * @param bounds 根矩形
 * @param opts 关闭与各道具使用
 * @returns 面板 API（`destroy` 关闭）
 */
export function attachPropBagPanel(
    parent: Node,
    bounds: { width: number; height: number; left: number; bottom: number },
    opts: {
        onClose: () => void;
        onHint: () => void;
        onTime: () => void;
        onSmallTime: () => void;
        onRevealTop: () => void;
        onShuffleStock: () => void;
    },
): PropBagPanelApi {
    const { overlay, ovOp } = mountPropBagOverlay(parent, bounds);
    const panel = buildPropBagPanelShell();
    overlay.addChild(panel);
    addPropBagPanelHeader(panel, opts.onClose);
    const subLabels: Label[] = [];
    addPropBagOptionRow(panel, 96, '提示', opts.onHint, subLabels);
    addPropBagOptionRow(panel, 20, '加时', opts.onTime, subLabels);
    addPropBagOptionRow(panel, -56, '短补', opts.onSmallTime, subLabels);
    addPropBagOptionRow(panel, -132, '亮顶', opts.onRevealTop, subLabels);
    addPropBagOptionRow(panel, -208, '洗背', opts.onShuffleStock, subLabels);

    panel.setScale(new Vec3(0.88, 0.88, 1));
    tween(panel)
        .to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: easing.backOut })
        .start();

    return makePropBagPanelApi(overlay, ovOp, subLabels);
}
