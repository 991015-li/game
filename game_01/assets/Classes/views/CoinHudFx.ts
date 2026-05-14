import { Color, Graphics, Layers, Node, UITransform, Vec3, easing, tween } from 'cc';

/**
 * 顶栏金币 HUD 的矢量图标与小动效封装（仅视图层，**不**含扣费/数值逻辑）。
 */

/**
 * 构建一枚圆形矢量金币图标节点（用于顶栏等）。
 *
 * @param diameter 外接正方形边长（像素级 UI）
 * @returns 未入树的 `Node`，由调用方挂到父节点
 */
export function buildCoinIconNode(diameter: number): Node {
    const n = new Node('coinIcon');
    n.layer = Layers.Enum.UI_2D;
    n.addComponent(UITransform).setContentSize(diameter, diameter);
    const g = n.addComponent(Graphics);
    const r = diameter * 0.42;
    g.fillColor = new Color(252, 196, 52, 255);
    g.circle(0, 0, r);
    g.fill();
    g.fillColor = new Color(255, 228, 130, 255);
    g.circle(-r * 0.28, r * 0.22, r * 0.2);
    g.fill();
    g.lineWidth = Math.max(1.5, diameter * 0.06);
    g.strokeColor = new Color(198, 130, 28, 255);
    g.circle(0, 0, r);
    g.stroke();
    g.fillColor = new Color(220, 160, 40, 255);
    g.circle(0, 0, r * 0.35);
    g.fill();
    return n;
}

/**
 * 为金币图标启动常驻轻微摇摆 + 呼吸缩放 tween（重复播放直至节点失效）。
 *
 * @param iconNode {@link buildCoinIconNode} 或其它带 `scale` 的节点
 * @returns void
 */
export function startCoinIconIdleTween(iconNode: Node): void {
    if (!iconNode.isValid) {
        return;
    }
    const s0 = iconNode.scale.x;
    tween(iconNode)
        .repeatForever(
            tween()
                .to(0.55, { angle: 10 }, { easing: easing.sineInOut })
                .to(0.55, { angle: -10 }, { easing: easing.sineInOut })
                .to(0.45, { angle: 0 }, { easing: easing.sineInOut })
                .to(0.55, { scale: new Vec3(s0 * 1.08, s0 * 1.08, 1) }, { easing: easing.sineInOut })
                .to(0.55, { scale: new Vec3(s0, s0, 1) }, { easing: easing.sineInOut }),
        )
        .start();
}

/**
 * 金币数字块数额变化时的短促缩放脉冲（一次性 tween）。
 *
 * @param target 一般为包住图标+文案的父节点或图标节点
 * @returns void
 */
export function playCoinHudChangedPulse(target: Node): void {
    if (!target.isValid) {
        return;
    }
    const sx = target.scale.x;
    const sy = target.scale.y;
    tween(target)
        .to(0.07, { scale: new Vec3(sx * 1.14, sy * 1.14, 1) })
        .to(0.12, { scale: new Vec3(sx * 0.96, sy * 0.96, 1) })
        .to(0.1, { scale: new Vec3(sx, sy, 1) }, { easing: easing.backOut })
        .start();
}
