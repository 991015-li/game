import { Color, Graphics, Layers, Node, UIOpacity, UITransform, Vec3, easing, tween } from 'cc';

/**
 * 对局与胜利相关**纯视图特效**（节点 + tween），无存档与规则。
 */

export type ShellBounds = { width: number; height: number; left: number; bottom: number };

/**
 * @param root 父节点
 * @param localPos 爆发中心（相对 `root`）
 */
export function spawnSparkleBurst(root: Node, localPos: Vec3): void {
    const holder = new Node('sparkleBurst');
    holder.layer = Layers.Enum.UI_2D;
    holder.setPosition(localPos);
    root.addChild(holder);
    const colors = [
        new Color(255, 248, 210, 255),
        new Color(255, 220, 160, 255),
        new Color(200, 240, 220, 255),
    ];
    const n = 10;
    for (let i = 0; i < n; i++) {
        const p = new Node(`sp${i}`);
        p.layer = Layers.Enum.UI_2D;
        const g = p.addComponent(Graphics);
        const r = 2.5 + Math.random() * 2.5;
        g.circle(0, 0, r);
        g.fillColor = colors[i % colors.length]!;
        g.fill();
        p.setPosition((Math.random() - 0.5) * 28, (Math.random() - 0.5) * 18, 0);
        holder.addChild(p);
        const op = p.addComponent(UIOpacity);
        op.opacity = 255;
        const vx = (Math.random() - 0.5) * 220;
        const vy = 40 + Math.random() * 70;
        tween(p)
            .parallel(
                tween(p).by(0.38, { position: new Vec3(vx * 0.35, vy, 0) }, { easing: easing.quadOut }),
                tween(op).to(0.36, { opacity: 0 }),
            )
            .start();
    }
    tween(holder)
        .delay(0.45)
        .call(() => {
            if (holder.isValid) {
                holder.destroy();
            }
        })
        .start();
}

function spawnOneConfettiPiece(parent: Node, bounds: ShellBounds, topY: number, palette: Color[], index: number, behind: boolean): void {
    const piece = new Node(`confetti${index}`);
    piece.layer = Layers.Enum.UI_2D;
    const w = 5 + Math.floor(Math.random() * 5);
    const h = 7 + Math.floor(Math.random() * 8);
    piece.addComponent(UITransform).setContentSize(w, h);
    const g = piece.addComponent(Graphics);
    g.rect(-w * 0.5, -h * 0.5, w, h);
    g.fillColor = palette[index % palette.length]!;
    g.fill();
    const x0 = bounds.left + 48 + Math.random() * Math.max(40, bounds.width - 96);
    piece.setPosition(x0, topY + Math.random() * 40, 0);
    piece.angle = Math.random() * 360;
    if (behind) {
        parent.insertChild(piece, 0);
    } else {
        parent.addChild(piece);
    }
    const op = piece.addComponent(UIOpacity);
    op.opacity = 255;
    const drift = (Math.random() - 0.5) * 160;
    const fall = -(bounds.height * 0.52 + Math.random() * 120);
    const dur = 1.35 + Math.random() * 0.55;
    tween(piece)
        .parallel(
            tween(piece).to(dur, { position: new Vec3(x0 + drift, topY + fall, 0) }, { easing: easing.quadIn }),
            tween(piece).by(dur, { angle: 240 + Math.random() * 200 }),
            tween(op).delay(dur * 0.55).to(dur * 0.45, { opacity: 0 }),
        )
        .call(() => {
            if (piece.isValid) {
                piece.destroy();
            }
        })
        .start();
}

/**
 * @param parent 一般为 `winOverlay`
 * @param bounds shell 外接矩形
 * @param behind 插入最底层
 */
export function spawnWinConfetti(parent: Node, bounds: ShellBounds, behind = false): void {
    const topY = bounds.bottom + bounds.height - 36;
    const palette = [
        new Color(255, 214, 120, 255),
        new Color(255, 170, 140, 255),
        new Color(170, 220, 190, 255),
        new Color(200, 180, 240, 255),
    ];
    const count = 22;
    for (let i = 0; i < count; i++) {
        spawnOneConfettiPiece(parent, bounds, topY, palette, i, behind);
    }
}
