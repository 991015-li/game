import { Button, Color, Graphics, Label, Layers, Node, Sprite, UITransform, UIOpacity, Vec3, tween, easing } from 'cc';
import {
    kPropAddTimeIconUrl,
    kPropBuyInventoryHintPrice,
    kPropBuyInventoryRevealPrice,
    kPropBuyInventoryShuffleStockPrice,
    kPropBuyInventorySmallTimePrice,
    kPropBuyInventoryTimePrice,
    kPropHintIconUrl,
    kPropRevealTopIconUrl,
    kPropShuffleStockIconUrl,
    kPropSmallTimeIconUrl,
} from '../configs/GameplayPropsConfig';
import { kPearlOnColor, kPanelBodyMuted } from '../configs/UiWarmPalette';
import { PlayerProgressService } from '../services/PlayerProgressService';
import { relaxLabelDensity } from '../utils/LabelReadability';
import { applyRemoteUrlToSprite } from '../utils/RemoteSpriteUtil';

/**
 * 选关页道具商店：遮罩、购买行与金币校验（经 {@link PlayerProgressService} 落盘）。
 */

type PropShopBuyContext = {
    refreshSub: () => void;
    onAfterBuy: () => void;
    onToast: (msg: string) => void;
};

/**
 * 选关页「道具商店」全屏浮层：用金币购买持久库存（不产生对局状态）。
 *
 * @param parent 通常为 shell
 * @param bounds 与 shell 一致的根矩形
 * @param opts 关闭、购后刷新与 Toast
 * @returns 遮罩根节点（需 `destroy` 关闭）
 */
export function attachPropShopPanel(
    parent: Node,
    bounds: { width: number; height: number; left: number; bottom: number },
    opts: { onClose: () => void; onAfterBuy: () => void; onToast: (msg: string) => void },
): Node {
    const overlay = mountPropShopOverlay(parent, bounds);
    const panel = buildPropShopPanelShell();
    overlay.addChild(panel);
    addPropShopTitle(panel);
    const { refreshSub } = addPropShopInventorySubtitle(panel);
    refreshSub();
    addPropShopCloseButton(panel, opts.onClose);
    const buyCtx: PropShopBuyContext = { refreshSub, onAfterBuy: opts.onAfterBuy, onToast: opts.onToast };
    wirePropShopBuyRows(panel, opts, buyCtx);
    panel.setScale(new Vec3(0.9, 0.9, 1));
    tween(panel)
        .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: easing.backOut })
        .start();
    return overlay;
}

/** 扣费并增加道具库存；金币不足时 Toast 并返回 `false`。 */
function tryBuyPropForCoins(
    opts: { onToast: (msg: string) => void },
    price: number,
    creditInventory: () => void,
): () => boolean {
    return () => {
        if (PlayerProgressService.getCoins() < price) {
            opts.onToast(`金币不足，购买需 ${price} 金`);
            return false;
        }
        PlayerProgressService.addCoins(-price);
        creditInventory();
        return true;
    };
}

type PropShopRowSpec = {
    y: number;
    title: string;
    price: number;
    iconUrl: string;
    creditInventory: () => void;
};

function propShopRowSpecs(): PropShopRowSpec[] {
    return [
        {
            y: 176,
            title: '提示 +1',
            price: kPropBuyInventoryHintPrice,
            iconUrl: kPropHintIconUrl,
            creditInventory: () => PlayerProgressService.addPropInventoryHint(1),
        },
        {
            y: 88,
            title: '加时 +1',
            price: kPropBuyInventoryTimePrice,
            iconUrl: kPropAddTimeIconUrl,
            creditInventory: () => PlayerProgressService.addPropInventoryTime(1),
        },
        {
            y: 0,
            title: '短补 +1',
            price: kPropBuyInventorySmallTimePrice,
            iconUrl: kPropSmallTimeIconUrl,
            creditInventory: () => PlayerProgressService.addPropInventorySmallTime(1),
        },
        {
            y: -88,
            title: '亮顶 +1',
            price: kPropBuyInventoryRevealPrice,
            iconUrl: kPropRevealTopIconUrl,
            creditInventory: () => PlayerProgressService.addPropInventoryReveal(1),
        },
        {
            y: -176,
            title: '洗背 +1',
            price: kPropBuyInventoryShuffleStockPrice,
            iconUrl: kPropShuffleStockIconUrl,
            creditInventory: () => PlayerProgressService.addPropInventoryShuffleStock(1),
        },
    ];
}

function wirePropShopBuyRows(panel: Node, opts: { onToast: (msg: string) => void }, buyCtx: PropShopBuyContext): void {
    const t = opts;
    for (const r of propShopRowSpecs()) {
        addPropShopBuyRow(
            panel,
            r.y,
            r.title,
            r.price,
            r.iconUrl,
            tryBuyPropForCoins(t, r.price, r.creditInventory),
            buyCtx,
        );
    }
}

function mountPropShopOverlay(
    parent: Node,
    bounds: { width: number; height: number; left: number; bottom: number }
): Node {
    const overlay = new Node('propShopOverlay');
    overlay.layer = Layers.Enum.UI_2D;
    overlay.addComponent(UITransform).setContentSize(bounds.width, bounds.height);
    const og = overlay.addComponent(Graphics);
    og.rect(bounds.left, bounds.bottom, bounds.width, bounds.height);
    og.fillColor = new Color(18, 22, 28, 210);
    og.fill();
    const ovOp = overlay.addComponent(UIOpacity);
    ovOp.opacity = 0;
    parent.addChild(overlay);
    tween(ovOp).to(0.18, { opacity: 255 }).start();
    return overlay;
}

function buildPropShopPanelShell(): Node {
    const panel = new Node('propShopPanel');
    panel.layer = Layers.Enum.UI_2D;
    panel.addComponent(UITransform).setContentSize(620, 560);
    const pg = panel.addComponent(Graphics);
    pg.roundRect(-310, -280, 620, 560, 22);
    pg.fillColor = new Color(252, 248, 240, 255);
    pg.fill();
    pg.roundRect(-310, -280, 620, 560, 22);
    pg.strokeColor = new Color(120, 160, 150, 160);
    pg.lineWidth = 2;
    pg.stroke();
    return panel;
}

function addPropShopTitle(panel: Node): void {
    const titleN = new Node('title');
    titleN.layer = Layers.Enum.UI_2D;
    titleN.setPosition(0, 232, 0);
    titleN.addComponent(UITransform).setContentSize(520, 48);
    const tl = titleN.addComponent(Label);
    tl.string = '道具商店';
    tl.fontSize = 40;
    tl.lineHeight = 48;
    tl.horizontalAlign = Label.HorizontalAlign.CENTER;
    tl.overflow = Label.Overflow.SHRINK;
    tl.color = new Color(52, 108, 96, 255);
    relaxLabelDensity(tl, 1);
    panel.addChild(titleN);
}

function addPropShopInventorySubtitle(panel: Node): { subL: Label; refreshSub: () => void } {
    const subN = new Node('sub');
    subN.layer = Layers.Enum.UI_2D;
    subN.setPosition(0, 168, 0);
    subN.addComponent(UITransform).setContentSize(560, 56);
    const subL = subN.addComponent(Label);
    subL.fontSize = 22;
    subL.lineHeight = 30;
    subL.horizontalAlign = Label.HorizontalAlign.CENTER;
    subL.verticalAlign = Label.VerticalAlign.CENTER;
    subL.overflow = Label.Overflow.SHRINK;
    subL.enableWrapText = true;
    subL.color = kPanelBodyMuted;
    relaxLabelDensity(subL, 1);
    panel.addChild(subN);
    const refreshSub = (): void => {
        const h = PlayerProgressService.getPropInventoryHint();
        const t = PlayerProgressService.getPropInventoryTime();
        const s = PlayerProgressService.getPropInventorySmallTime();
        const r = PlayerProgressService.getPropInventoryReveal();
        const sh = PlayerProgressService.getPropInventoryShuffleStock();
        subL.string = `当前库存（优先于当场扣金）\n提示 ${h}　加时 ${t}　短补 ${s}　亮顶 ${r}　洗背 ${sh}`;
    };
    return { subL, refreshSub };
}

function addPropShopCloseButton(panel: Node, onClose: () => void): void {
    const closeN = new Node('close');
    closeN.layer = Layers.Enum.UI_2D;
    closeN.setPosition(268, 248, 0);
    closeN.addComponent(UITransform).setContentSize(64, 44);
    const cb = closeN.addComponent(Button);
    cb.transition = Button.Transition.SCALE;
    cb.zoomScale = 1.06;
    const cg = closeN.addComponent(Graphics);
    cg.roundRect(-28, -18, 56, 36, 8);
    cg.fillColor = new Color(200, 205, 198, 255);
    cg.fill();
    const cx = new Node('x');
    cx.layer = Layers.Enum.UI_2D;
    cx.addComponent(UITransform).setContentSize(48, 32);
    const cxl = cx.addComponent(Label);
    cxl.string = '✕';
    cxl.fontSize = 26;
    cxl.color = new Color(72, 88, 82, 255);
    closeN.addChild(cx);
    closeN.on(Button.EventType.CLICK, onClose);
    panel.addChild(closeN);
}

function buyRowChrome(row: Node): void {
    const rg = row.addComponent(Graphics);
    rg.roundRect(-270, -38, 540, 76, 14);
    rg.fillColor = new Color(255, 252, 246, 255);
    rg.fill();
    rg.roundRect(-270, -38, 540, 76, 14);
    rg.strokeColor = new Color(180, 195, 185, 180);
    rg.lineWidth = 2;
    rg.stroke();
}

function buyRowAddIcon(row: Node, iconUrl: string): void {
    const ic = new Node('ic');
    ic.layer = Layers.Enum.UI_2D;
    ic.setPosition(-218, 0, 0);
    ic.addComponent(UITransform).setContentSize(44, 44);
    const sp = ic.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    row.addChild(ic);
    applyRemoteUrlToSprite(sp, iconUrl);
}

function buyRowAddTexts(row: Node, title: string, price: number): void {
    const tn = new Node('t');
    tn.layer = Layers.Enum.UI_2D;
    tn.setPosition(-72, 10, 0);
    tn.addComponent(UITransform).setContentSize(260, 28);
    const tlb = tn.addComponent(Label);
    tlb.string = title;
    tlb.fontSize = 26;
    tlb.lineHeight = 32;
    tlb.horizontalAlign = Label.HorizontalAlign.LEFT;
    tlb.verticalAlign = Label.VerticalAlign.CENTER;
    tlb.overflow = Label.Overflow.SHRINK;
    tlb.color = new Color(56, 92, 82, 255);
    relaxLabelDensity(tlb, 1);
    row.addChild(tn);

    const pn = new Node('p');
    pn.layer = Layers.Enum.UI_2D;
    pn.setPosition(-72, -16, 0);
    pn.addComponent(UITransform).setContentSize(280, 30);
    const plb = pn.addComponent(Label);
    plb.string = `${price} 金币 · +1 库存`;
    plb.fontSize = 20;
    plb.lineHeight = 28;
    plb.horizontalAlign = Label.HorizontalAlign.LEFT;
    plb.verticalAlign = Label.VerticalAlign.CENTER;
    plb.overflow = Label.Overflow.SHRINK;
    plb.color = new Color(160, 120, 48, 255);
    relaxLabelDensity(plb, 1);
    row.addChild(pn);
}

function buyRowAddPurchaseBtn(
    row: Node,
    tryBuy: () => boolean,
    ctx: PropShopBuyContext,
): void {
    const bn = new Node('buy');
    bn.layer = Layers.Enum.UI_2D;
    bn.setPosition(212, 0, 0);
    bn.addComponent(UITransform).setContentSize(112, 44);
    const bb = bn.addComponent(Button);
    bb.transition = Button.Transition.SCALE;
    bb.zoomScale = 1.05;
    const bg = bn.addComponent(Graphics);
    bg.roundRect(-52, -20, 104, 40, 10);
    bg.fillColor = new Color(220, 156, 64, 255);
    bg.fill();
    const blN = new Node('bl');
    blN.layer = Layers.Enum.UI_2D;
    blN.addComponent(UITransform).setContentSize(100, 36);
    const bl = blN.addComponent(Label);
    bl.string = '购买';
    bl.fontSize = 24;
    bl.lineHeight = 32;
    bl.horizontalAlign = Label.HorizontalAlign.CENTER;
    bl.verticalAlign = Label.VerticalAlign.CENTER;
    bl.overflow = Label.Overflow.SHRINK;
    bl.color = kPearlOnColor;
    relaxLabelDensity(bl, 1);
    bn.addChild(blN);
    bn.on(Button.EventType.CLICK, () => {
        if (tryBuy()) {
            ctx.refreshSub();
            ctx.onAfterBuy();
        }
    });
    row.addChild(bn);
}

function addPropShopBuyRow(
    panel: Node,
    y: number,
    title: string,
    price: number,
    iconUrl: string,
    tryBuy: () => boolean,
    ctx: PropShopBuyContext,
): void {
    const row = new Node(title);
    row.layer = Layers.Enum.UI_2D;
    row.setPosition(0, y, 0);
    row.addComponent(UITransform).setContentSize(540, 78);
    buyRowChrome(row);
    buyRowAddIcon(row, iconUrl);
    buyRowAddTexts(row, title, price);
    buyRowAddPurchaseBtn(row, tryBuy, ctx);
    panel.addChild(row);
}