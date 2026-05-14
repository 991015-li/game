import { Button, Color, Graphics, Label, Layers, Node, UITransform, Vec3, tween, UIOpacity, easing } from 'cc';
import { kOnDarkButton, kStrokeWarmGlass } from '../configs/UiWarmPalette';

/**
 * 通关后的模态胜利对话框：遮罩、标题与「重玩 / 返回大厅 / 下一关」操作。
 * 不访问对局模型，仅通过回调与外部交互。
 */

export interface GameWinDialogOptions {
    /** 是否存在可进入的下一关 */
    hasNextLevel: boolean;
    /** 本次通关评星 1～3 */
    stars: number;
    /** 本次通关用时展示文本，如 `0:45` */
    timeText: string;
    /** 当前关卡重开 */
    onReplay: () => void;
    /** 返回选关界面 */
    onBackToMenu: () => void;
    /** 进入下一关（仅当 hasNextLevel 为 true 时可点） */
    onNextLevel: () => void;
}

function mountWinDialogOverlay(
    root: Node,
    bounds: { width: number; height: number; left: number; bottom: number }
): Node {
    const overlay = new Node('winOverlay');
    overlay.layer = Layers.Enum.UI_2D;
    overlay.addComponent(UITransform).setContentSize(bounds.width, bounds.height);
    const og = overlay.addComponent(Graphics);
    og.rect(bounds.left, bounds.bottom, bounds.width, bounds.height);
    og.fillColor = new Color(0, 0, 0, 165);
    og.fill();
    const ovOp = overlay.addComponent(UIOpacity);
    ovOp.opacity = 0;
    root.addChild(overlay);
    tween(ovOp).to(0.22, { opacity: 255 }).start();
    return overlay;
}

function buildWinDialogPanel(): Node {
    const panel = new Node('winDialog');
    panel.layer = Layers.Enum.UI_2D;
    panel.addComponent(UITransform).setContentSize(700, 560);
    const pg = panel.addComponent(Graphics);
    pg.roundRect(-350, -280, 700, 560, 26);
    pg.fillColor = new Color(48, 28, 68, 245);
    pg.fill();
    pg.roundRect(-350, -280, 700, 560, 26);
    pg.strokeColor = new Color(255, 233, 170, 170);
    pg.lineWidth = 3;
    pg.stroke();

    pg.roundRect(-350, 144, 700, 136, 26);
    pg.fillColor = new Color(98, 54, 136, 240);
    pg.fill();

    pg.circle(-248, 224, 12);
    pg.fillColor = new Color(255, 214, 102, 235);
    pg.fill();
    pg.circle(248, 224, 12);
    pg.fill();
    return panel;
}

function addWinTitle(panel: Node): void {
    const title = new Node('title');
    title.layer = Layers.Enum.UI_2D;
    title.setPosition(0, 208, 0);
    title.addComponent(UITransform).setContentSize(400, 92);
    const titleLabel = title.addComponent(Label);
    titleLabel.string = '胜利！';
    titleLabel.fontSize = 66;
    titleLabel.color = new Color(255, 246, 220, 255);
    panel.addChild(title);
}

function addWinStarRow(panel: Node, starsFilled: number): Node {
    const starLine = '★'.repeat(starsFilled) + '☆'.repeat(3 - starsFilled);
    const starRow = new Node('starRow');
    starRow.layer = Layers.Enum.UI_2D;
    starRow.setPosition(0, 148, 0);
    starRow.addComponent(UITransform).setContentSize(420, 72);
    const starLb = starRow.addComponent(Label);
    starLb.string = starLine;
    starLb.fontSize = 56;
    starLb.lineHeight = 72;
    starLb.color = new Color(255, 220, 96, 255);
    panel.addChild(starRow);
    return starRow;
}

function addWinSubtitle(panel: Node, starsFilled: number, timeText: string): void {
    const subtitle = new Node('subtitle');
    subtitle.layer = Layers.Enum.UI_2D;
    subtitle.setPosition(0, 76, 0);
    subtitle.addComponent(UITransform).setContentSize(560, 56);
    const subtitleLabel = subtitle.addComponent(Label);
    subtitleLabel.string = `用时 ${timeText}  ·  ${starsFilled} 星`;
    subtitleLabel.fontSize = 30;
    subtitleLabel.color = new Color(235, 225, 245, 255);
    panel.addChild(subtitle);
}

function wireWinDialogButtons(panel: Node, opts: GameWinDialogOptions): void {
    addDialogButton(panel, '重玩一遍', 0, -12, true, { bg: new Color(75, 132, 205, 255), text: kOnDarkButton }, opts.onReplay);
    addDialogButton(
        panel,
        '返回大厅',
        0,
        -112,
        true,
        { bg: new Color(94, 94, 122, 255), text: kOnDarkButton },
        opts.onBackToMenu
    );
    addDialogButton(
        panel,
        opts.hasNextLevel ? '下一关' : '下一关（已是最后）',
        0,
        -212,
        opts.hasNextLevel,
        { bg: new Color(230, 165, 62, 255), text: new Color(52, 30, 6, 255) },
        opts.onNextLevel
    );
}

function playWinDialogEntrance(panel: Node, starRow: Node): void {
    panel.setScale(new Vec3(0.82, 0.82, 1));
    tween(panel)
        .to(0.2, { scale: new Vec3(1.05, 1.05, 1) }, { easing: easing.backOut })
        .to(0.1, { scale: new Vec3(1, 1, 1) }, { easing: easing.sineOut })
        .start();

    starRow.setScale(new Vec3(0.2, 0.2, 1));
    tween(starRow)
        .delay(0.14)
        .to(0.26, { scale: new Vec3(1.12, 1.12, 1) }, { easing: easing.backOut })
        .to(0.1, { scale: new Vec3(1, 1, 1) })
        .start();
}

/**
 * 在根节点上叠加全屏胜利 UI。
 * @param root 一般为对局 shell
 * @param bounds 与 shell 一致的根矩形（`left`/`bottom`/`width`/`height`）
 * @param opts 按钮行为
 */
export function attachGameWinDialog(
    root: Node,
    bounds: { width: number; height: number; left: number; bottom: number },
    opts: GameWinDialogOptions
): void {
    const overlay = mountWinDialogOverlay(root, bounds);
    const panel = buildWinDialogPanel();
    overlay.addChild(panel);
    addWinTitle(panel);
    const starsFilled = Math.max(0, Math.min(3, Math.floor(opts.stars)));
    const starRow = addWinStarRow(panel, starsFilled);
    addWinSubtitle(panel, starsFilled, opts.timeText);
    wireWinDialogButtons(panel, opts);
    playWinDialogEntrance(panel, starRow);
}

function addDialogButton(
    parent: Node,
    text: string,
    x: number,
    y: number,
    enabled: boolean,
    colors: { bg: Color; text: Color },
    fn: () => void
): void {
    const buttonNode = new Node(text);
    buttonNode.layer = Layers.Enum.UI_2D;
    buttonNode.setPosition(x, y, 0);
    buttonNode.addComponent(UITransform).setContentSize(360, 78);

    const btn = buttonNode.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = enabled ? 1.05 : 1;

    const g = buttonNode.addComponent(Graphics);
    g.roundRect(-166, -32, 332, 64, 14);
    g.fillColor = enabled ? colors.bg : new Color(95, 95, 108, 255);
    g.fill();
    g.roundRect(-166, -32, 332, 64, 14);
    g.strokeColor = enabled ? kStrokeWarmGlass : new Color(175, 168, 165, 70);
    g.lineWidth = 2;
    g.stroke();

    const labelNode = new Node('lbl');
    labelNode.layer = Layers.Enum.UI_2D;
    labelNode.addComponent(UITransform).setContentSize(312, 50);
    const lb = labelNode.addComponent(Label);
    lb.string = text;
    lb.fontSize = 34;
    lb.color = enabled ? colors.text : new Color(200, 192, 188, 255);
    buttonNode.addChild(labelNode);

    if (enabled) {
        buttonNode.on(Button.EventType.CLICK, fn);
    }
    parent.addChild(buttonNode);
}
