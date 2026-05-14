import { Button, Color, Graphics, Label, Layers, Node, UITransform, Vec3, tween, UIOpacity, easing } from 'cc';
import { kOnDarkButton } from '../configs/UiWarmPalette';
import { formatElapsedMmSs } from '../services/LevelStarService';

/**
 * 关卡时限耗尽时的失败弹窗：遮罩、说明与「重玩 / 选关」。
 */

export interface GameFailDialogOptions {
    /** 本关限时（秒），用于提示文案 */
    timeLimitSec: number;
    /** 当前关卡重开 */
    onReplay: () => void;
    /** 返回选关 */
    onBackToMenu: () => void;
}

function mountFailDialogOverlay(
    root: Node,
    bounds: { width: number; height: number; left: number; bottom: number }
): Node {
    const overlay = new Node('failOverlay');
    overlay.layer = Layers.Enum.UI_2D;
    overlay.addComponent(UITransform).setContentSize(bounds.width, bounds.height);
    const og = overlay.addComponent(Graphics);
    og.rect(bounds.left, bounds.bottom, bounds.width, bounds.height);
    og.fillColor = new Color(0, 0, 0, 175);
    og.fill();
    const ovOp = overlay.addComponent(UIOpacity);
    ovOp.opacity = 0;
    root.addChild(overlay);
    tween(ovOp).to(0.2, { opacity: 255 }).start();
    return overlay;
}

function buildFailDialogPanel(): Node {
    const panel = new Node('failDialog');
    panel.layer = Layers.Enum.UI_2D;
    panel.addComponent(UITransform).setContentSize(640, 440);
    const pg = panel.addComponent(Graphics);
    pg.roundRect(-320, -220, 640, 440, 22);
    pg.fillColor = new Color(52, 28, 32, 248);
    pg.fill();
    pg.roundRect(-320, -220, 640, 440, 22);
    pg.strokeColor = new Color(255, 180, 160, 140);
    pg.lineWidth = 3;
    pg.stroke();
    return panel;
}

function addFailDialogCopy(panel: Node, timeLimitSec: number): void {
    const title = new Node('title');
    title.layer = Layers.Enum.UI_2D;
    title.setPosition(0, 120, 0);
    title.addComponent(UITransform).setContentSize(520, 80);
    const titleLb = title.addComponent(Label);
    titleLb.string = '挑战失败';
    titleLb.fontSize = 56;
    titleLb.color = new Color(255, 220, 210, 255);
    panel.addChild(title);

    const sub = new Node('sub');
    sub.layer = Layers.Enum.UI_2D;
    sub.setPosition(0, 28, 0);
    sub.addComponent(UITransform).setContentSize(560, 100);
    const subLb = sub.addComponent(Label);
    subLb.string = `本关限时 ${formatElapsedMmSs(timeLimitSec)} 已用尽\n主牌堆未清完`;
    subLb.fontSize = 30;
    subLb.lineHeight = 42;
    subLb.color = new Color(235, 210, 205, 255);
    panel.addChild(sub);
}

/**
 * @param root 一般为对局 shell
 * @param bounds 与 shell 一致的根矩形
 */
export function attachGameFailDialog(
    root: Node,
    bounds: { width: number; height: number; left: number; bottom: number },
    opts: GameFailDialogOptions
): void {
    const overlay = mountFailDialogOverlay(root, bounds);
    const panel = buildFailDialogPanel();
    overlay.addChild(panel);
    addFailDialogCopy(panel, opts.timeLimitSec);
    addFailButton(panel, '重试本关', 0, -72, opts.onReplay);
    addFailButton(panel, '返回选关', 0, -160, opts.onBackToMenu, new Color(94, 94, 122, 255));

    panel.setScale(new Vec3(0.85, 0.85, 1));
    tween(panel)
        .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: easing.backOut })
        .start();
}

function addFailButton(parent: Node, text: string, x: number, y: number, fn: () => void, bg?: Color): void {
    const n = new Node(text);
    n.layer = Layers.Enum.UI_2D;
    n.setPosition(x, y, 0);
    n.addComponent(UITransform).setContentSize(320, 72);
    const btn = n.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 1.04;
    const g = n.addComponent(Graphics);
    g.roundRect(-150, -32, 300, 64, 14);
    g.fillColor = bg ?? new Color(190, 86, 72, 255);
    g.fill();
    const child = new Node('lbl');
    child.layer = Layers.Enum.UI_2D;
    child.addComponent(UITransform).setContentSize(280, 44);
    const lb = child.addComponent(Label);
    lb.string = text;
    lb.fontSize = 32;
    lb.color = kOnDarkButton;
    n.addChild(child);
    n.on(Button.EventType.CLICK, fn);
    parent.addChild(n);
}
