import { Color, Label, Layers, Node, UIOpacity, UITransform, Vec3, easing, tween } from 'cc';
import { relaxLabelDensity } from './LabelReadability';

/**
 * 对局「手感」辅助：飞牌（直线/弧线）、缩放回弹、飘字等纯表现（{@link tween}）。
 */

const kCardFlyArcScratchMid = new Vec3();

/**
 * 卡牌直线平移到目标（无弧线），用于桌面牌接手牌顶等「平移替换」表现。
 *
 * @param fly 飞行用临时节点
 * @param start 起点（根局部）
 * @param end 终点（根局部）
 * @param duration 总时长（秒）
 * @param onComplete 结束回调（在节点仍有效时调用）
 */
export function tweenCardFlyLinear(fly: Node, start: Vec3, end: Vec3, duration: number, onComplete: () => void): void {
    fly.setPosition(start);
    tween(fly)
        .to(duration, { position: end.clone() }, { easing: easing.quadInOut })
        .call(onComplete)
        .start();
}

/**
 * 卡牌飞到手牌的弧线位移 + 轻微回转，比直线 tween 更有物理感。
 *
 * @param fly 飞行用临时节点
 * @param start 起点（根局部）
 * @param end 终点（根局部）
 * @param duration 总时长（秒）
 * @param onComplete 结束回调（在节点仍有效时调用）
 */
export function tweenCardFlyArc(fly: Node, start: Vec3, end: Vec3, duration: number, onComplete: () => void): void {
    const lift = Math.min(130, Math.max(56, Math.abs(end.x - start.x) * 0.28 + 48));
    kCardFlyArcScratchMid.x = (start.x + end.x) * 0.5;
    kCardFlyArcScratchMid.y = Math.max(start.y, end.y) + lift;
    kCardFlyArcScratchMid.z = start.z;
    const up = duration * 0.42;
    const down = Math.max(0.08, duration - up);
    const tilt = start.x <= end.x ? 7.5 : -7.5;
    fly.angle = tilt;
    tween(fly)
        .parallel(
            tween()
                .to(up, { position: kCardFlyArcScratchMid.clone() }, { easing: easing.sineOut })
                .to(down, { position: end.clone() }, { easing: easing.cubicIn }),
            tween().to(duration * 0.9, { angle: 0 }, { easing: easing.quadOut }),
        )
        .call(onComplete)
        .start();
}

/**
 * 短时放大再回落（吃牌、HUD 等）。
 *
 * @param node 目标节点
 * @param peak 相对当前缩放的峰值乘数
 */
export function juicePopScale(node: Node, peak = 1.12): void {
    if (!node.isValid) {
        return;
    }
    const sx = node.scale.x;
    const sy = node.scale.y;
    tween(node)
        .to(0.07, { scale: new Vec3(sx * peak, sy * peak, 1) })
        .to(0.14, { scale: new Vec3(sx, sy, 1) }, { easing: easing.backOut })
        .start();
}

/**
 * 在根节点局部坐标处飘出文字并上浮淡出。
 *
 * @param root 父节点
 * @param localPos 文案起点
 * @param text 显示字符串
 * @param color 字色
 */
export function spawnFloaterLabel(root: Node, localPos: Vec3, text: string, color: Color): void {
    const n = new Node('floater');
    n.layer = Layers.Enum.UI_2D;
    n.setPosition(localPos);
    n.addComponent(UITransform).setContentSize(240, 48);
    const lb = n.addComponent(Label);
    lb.string = text;
    lb.fontSize = 30;
    lb.lineHeight = 40;
    lb.horizontalAlign = Label.HorizontalAlign.CENTER;
    lb.verticalAlign = Label.VerticalAlign.CENTER;
    lb.overflow = Label.Overflow.SHRINK;
    lb.color = color;
    relaxLabelDensity(lb, 1);
    root.addChild(n);
    const op = n.addComponent(UIOpacity);
    tween(n)
        .parallel(
            tween(n).by(0.52, { position: new Vec3(0, 64, 0) }, { easing: easing.quadOut }),
            tween(op).delay(0.18).to(0.34, { opacity: 0 }),
        )
        .call(() => {
            if (n.isValid) {
                n.destroy();
            }
        })
        .start();
}
