/**
 * 卡牌 UI 节点工厂：生成正面/背面牌节点、点击与轻摇反馈。
 * 仅负责视图呈现与资源加载缓存，不包含对局规则。
 */
import { Color, Graphics, Label, Layers, Node, UITransform, Button, Vec3, tween, Sprite, SpriteFrame, resources, easing } from 'cc';
import type { Card } from '../utils/CardEnums';
import { isRedSuit, rankLabel } from '../utils/CardEnums';

export const kCardWidth = 140;
export const kCardHeight = 216;
export const kCardStackStep = 60;

const kCardGeneralSkinPath = 'images/card_general';

/** 启动时预加载 `resources/images` 下 SpriteFrame，减少首局大量发牌时的解码与 IO 尖峰（不阻塞入口；失败不抛错以免首帧 ERROR） */
export function preloadCardSpriteFrames(): void {
    try {
        resources.preloadDir('images', SpriteFrame, undefined, () => {});
        resources.preloadDir('images/number', SpriteFrame, undefined, () => {});
        resources.preloadDir('images/suits', SpriteFrame, undefined, () => {});
    } catch {
        /* 资源目录缺失或引擎未就绪时忽略 */
    }
}

const spriteFrameCache = new Map<string, SpriteFrame | null>();
const spriteFramePending = new Map<string, Array<(spriteFrame: SpriteFrame | null) => void>>();

function loadSpriteFrame(path: string, onLoaded: (spriteFrame: SpriteFrame | null) => void): void {
    if (spriteFrameCache.has(path)) {
        onLoaded(spriteFrameCache.get(path) ?? null);
        return;
    }

    const pending = spriteFramePending.get(path);
    if (pending) {
        pending.push(onLoaded);
        return;
    }
    spriteFramePending.set(path, [onLoaded]);

    resources.load(`${path}/spriteFrame`, SpriteFrame, (err, spriteFrame) => {
        const callbacks = spriteFramePending.get(path) ?? [];
        spriteFramePending.delete(path);

        if (err || !spriteFrame) {
            spriteFrameCache.set(path, null);
            callbacks.forEach((callback) => callback(null));
            return;
        }
        spriteFrameCache.set(path, spriteFrame);
        callbacks.forEach((callback) => callback(spriteFrame));
    });
}

function addSkinSprite(parent: Node, path: string, width: number, height: number, x = 0, y = 0): void {
    const skin = new Node('skin');
    skin.layer = parent.layer;
    skin.addComponent(UITransform).setContentSize(width, height);
    skin.setPosition(x, y, 0);
    const sprite = skin.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    parent.addChild(skin);

    loadSpriteFrame(path, (spriteFrame) => {
        if (!spriteFrame || !skin.isValid) {
            return;
        }
        sprite.spriteFrame = spriteFrame;
    });
}

function suitImageName(suit: number): string {
    switch (suit) {
        case 0:
            return 'club';
        case 1:
            return 'diamond';
        case 2:
            return 'heart';
        case 3:
            return 'spade';
        default:
            return 'club';
    }
}

function cardColorName(card: Card): string {
    return isRedSuit(card.suit) ? 'red' : 'black';
}

function addCardArtwork(parent: Node, card: Card): void {
    const rank = rankLabel(card.rank);
    const color = cardColorName(card);
    const suit = suitImageName(card.suit);
    const left = -kCardWidth * 0.5;
    const top = kCardHeight * 0.5;

    addSkinSprite(parent, `images/number/small_${color}_${rank}`, 32, 38, left + 28, top - 30);
    addSkinSprite(parent, `images/suits/${suit}`, 26, 26, left + 78, top - 30);
    addSkinSprite(parent, `images/number/big_${color}_${rank}`, 74, 108, -1, -29);
}

function addDisabledOverlay(parent: Node): void {
    const overlay = new Node('disabledOverlay');
    overlay.layer = parent.layer;
    overlay.addComponent(UITransform).setContentSize(kCardWidth, kCardHeight);
    const g = overlay.addComponent(Graphics);
    const hw = kCardWidth * 0.5;
    const hh = kCardHeight * 0.5;
    g.roundRect(-hw, -hh, kCardWidth, kCardHeight, 13);
    g.fillColor = new Color(0, 0, 0, 170);
    g.fill();
    parent.addChild(overlay);
}

/** 创建背面朝上的牌节点 */
export function makeFaceDownCardNode(): Node {
    const root = new Node('CardDown');
    root.layer = Layers.Enum.UI_2D;
    const ui = root.addComponent(UITransform);
    ui.setContentSize(kCardWidth, kCardHeight);
    const g = root.addComponent(Graphics);
    const w = kCardWidth;
    const h = kCardHeight;
    const hw = w * 0.5;
    const hh = h * 0.5;
    g.roundRect(-hw, -hh, w, h, 13);
    g.fillColor = new Color(32, 48, 92, 255);
    g.fill();
    g.roundRect(-hw, -hh, w, h, 13);
    g.strokeColor = new Color(212, 198, 188, 255);
    g.lineWidth = 3;
    g.stroke();
    return root;
}

/**
 * 创建正面牌节点。
 * @param card 牌数据
 * @param disabled 是否叠加置灰蒙层（列顶不可用提示）
 */
export function makeFaceUpCardNode(card: Card, disabled = false): Node {
    const root = new Node('CardUp');
    root.layer = Layers.Enum.UI_2D;
    const ui = root.addComponent(UITransform);
    ui.setContentSize(kCardWidth, kCardHeight);
    const w = kCardWidth;
    const h = kCardHeight;
    addSkinSprite(root, kCardGeneralSkinPath, w, h);
    addCardArtwork(root, card);
    if (disabled) {
        addDisabledOverlay(root);
    }
    return root;
}

/** 同 {@link makeFaceUpCardNode}，命名兼容对局界面的「可翻开牌」语义 */
export function makeCardNode(card: Card, disabled = false): Node {
    return makeFaceUpCardNode(card, disabled);
}

/**
 * 为节点绑定点击（单次点击触发）。
 * @param target 目标节点
 * @param onEnd 点击回调
 */
export function attachTap(target: Node, onEnd: () => void): void {
    const btn = target.addComponent(Button);
    btn.transition = Button.Transition.NONE;
    target.on(Button.EventType.CLICK, () => {
        const sx = target.scale.x;
        const sy = target.scale.y;
        tween(target)
            .to(0.05, { scale: new Vec3(sx * 0.93, sy * 0.93, 1) })
            .to(0.1, { scale: new Vec3(sx, sy, 1) }, { easing: easing.backOut })
            .start();
        onEnd();
    });
}

/**
 * 在 X 轴上短时摇晃节点，用于无效点击反馈。
 * @param node 节点
 * @param baseX 还原位置 X
 */
export function shakeNodeX(node: Node, baseX: number): void {
    tween(node)
        .to(0.04, { position: new Vec3(baseX - 16, node.position.y, node.position.z) })
        .to(0.04, { position: new Vec3(baseX + 16, node.position.y, node.position.z) })
        .to(0.04, { position: new Vec3(baseX - 16, node.position.y, node.position.z) })
        .to(0.04, { position: new Vec3(baseX, node.position.y, node.position.z) })
        .start();
}
