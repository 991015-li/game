import { Button, Color, Graphics, Label, Layers, Node, UITransform, UIOpacity, Vec3, easing, tween } from 'cc';
import { kOnDarkButton, kParchment } from '../configs/UiWarmPalette';
import { relaxLabelDensity } from '../utils/LabelReadability';

export type GamePauseOverlayOptions = {
    /** 关闭浮层并恢复对局（计时扣除暂停时长） */
    onResume: () => void;
    /** 返回选关；不计入暂停补偿（直接离开本局） */
    onBackToMenu?: () => void;
};

function fadeInPauseBackdrop(
    root: Node,
    bounds: { width: number; height: number; left: number; bottom: number },
): Node {
    const overlay = new Node('pauseOverlay');
    overlay.layer = Layers.Enum.UI_2D;
    overlay.addComponent(UITransform).setContentSize(bounds.width, bounds.height);
    const og = overlay.addComponent(Graphics);
    og.rect(bounds.left, bounds.bottom, bounds.width, bounds.height);
    og.fillColor = new Color(8, 16, 14, 168);
    og.fill();
    const ovOp = overlay.addComponent(UIOpacity);
    ovOp.opacity = 0;
    root.addChild(overlay);
    tween(ovOp).to(0.15, { opacity: 255 }).start();
    return overlay;
}

function buildPausePanelShell(): Node {
    const panel = new Node('pausePanel');
    panel.layer = Layers.Enum.UI_2D;
    panel.addComponent(UITransform).setContentSize(520, 300);
    const pg = panel.addComponent(Graphics);
    pg.roundRect(-260, -150, 520, 300, 20);
    pg.fillColor = new Color(36, 68, 56, 250);
    pg.fill();
    pg.roundRect(-260, -150, 520, 300, 20);
    pg.strokeColor = new Color(190, 230, 210, 90);
    pg.lineWidth = 2;
    pg.stroke();
    return panel;
}

function addPauseTitles(panel: Node): void {
    const title = new Node('title');
    title.layer = Layers.Enum.UI_2D;
    title.setPosition(0, 72, 0);
    title.addComponent(UITransform).setContentSize(480, 72);
    const tl = title.addComponent(Label);
    tl.string = '已暂停';
    tl.fontSize = 48;
    tl.lineHeight = 64;
    tl.horizontalAlign = Label.HorizontalAlign.CENTER;
    tl.color = kParchment;
    relaxLabelDensity(tl, 1);
    panel.addChild(title);

    const sub = new Node('sub');
    sub.layer = Layers.Enum.UI_2D;
    sub.setPosition(0, 8, 0);
    sub.addComponent(UITransform).setContentSize(460, 48);
    const sl = sub.addComponent(Label);
    sl.string = '倒计时已冻结';
    sl.fontSize = 24;
    sl.lineHeight = 34;
    sl.horizontalAlign = Label.HorizontalAlign.CENTER;
    sl.color = new Color(200, 220, 210, 230);
    relaxLabelDensity(sl, 1);
    panel.addChild(sub);
}

function wirePauseButtons(panel: Node, opts: GamePauseOverlayOptions): void {
    addPausePanelButton(panel, '继续', 0, -56, opts.onResume);
    if (opts.onBackToMenu) {
        addPausePanelButton(panel, '选关', 0, -130, opts.onBackToMenu, new Color(52, 72, 64, 245));
    }
}

/**
 * 对局暂停遮罩：半透明底 + 提示 +「继续」（及可选「选关」）。
 *
 * @param root 对局 shell
 * @param bounds shell 外接矩形（与失败弹窗一致）
 * @param opts 按钮回调
 * @returns 遮罩根节点，便于调整 `siblingIndex`
 */
export function attachGamePauseOverlay(
    root: Node,
    bounds: { width: number; height: number; left: number; bottom: number },
    opts: GamePauseOverlayOptions,
): Node {
    const overlay = fadeInPauseBackdrop(root, bounds);
    const panel = buildPausePanelShell();
    overlay.addChild(panel);
    addPauseTitles(panel);
    wirePauseButtons(panel, opts);
    panel.setScale(new Vec3(0.88, 0.88, 1));
    tween(panel)
        .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: easing.backOut })
        .start();
    return overlay;
}

function addPausePanelButton(panel: Node, text: string, x: number, y: number, fn: () => void, fill = new Color(44, 52, 70, 235)): void {
    const n = new Node(text);
    n.layer = Layers.Enum.UI_2D;
    n.setPosition(x, y, 0);
    n.addComponent(UITransform).setContentSize(260, 56);
    const btn = n.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    const g = n.addComponent(Graphics);
    const rw = 240;
    g.roundRect(-rw * 0.5, -26, rw, 52, 10);
    g.fillColor = fill;
    g.fill();
    const child = new Node('lbl');
    child.layer = Layers.Enum.UI_2D;
    child.addComponent(UITransform).setContentSize(rw - 8, 48);
    const lb = child.addComponent(Label);
    lb.string = text;
    lb.fontSize = 28;
    lb.lineHeight = 36;
    lb.horizontalAlign = Label.HorizontalAlign.CENTER;
    lb.verticalAlign = Label.VerticalAlign.CENTER;
    lb.overflow = Label.Overflow.SHRINK;
    lb.color = kOnDarkButton;
    relaxLabelDensity(lb, 1);
    n.addChild(child);
    n.on(Button.EventType.CLICK, fn);
    panel.addChild(n);
}
