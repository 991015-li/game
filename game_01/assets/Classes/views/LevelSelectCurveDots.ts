import { Button, Color, Graphics, Label, Layers, Node, Sprite, UITransform, UIOpacity, Vec3, easing, tween } from 'cc';
import type { Mask } from 'cc';
import { kPearlOnColor } from '../configs/UiWarmPalette';
import { PlayerProgressService } from '../services/PlayerProgressService';
import { ccAdd, kEngineMaskTypeGraphicsEllipse } from '../utils/CcEngineComponent';
import { applyRemoteUrlToSprite } from '../utils/RemoteSpriteUtil';
import {
    kDotBuyable,
    kDotLocked,
    kDotPlayable,
    kRingBuyable,
    kRingLocked,
    kRingPlayable,
    kSelectDotLabelBuyable,
    kSelectDotLabelLocked,
    kSelectRouteLine,
} from './LevelSelectPalette';
import type { LevelRowState } from './LevelSelectTypes';

/**
 * 第 i 个圆心相对 `content`（锚点顶中）的局部坐标：x 相对中心左右摆动，y 为自顶向下的圆心距离。
 */
export function curvePointLocal(
    i: number,
    n: number,
    padYTop: number,
    radius: number,
    stepY: number,
    amp: number,
): { lx: number; cy: number } {
    const freq = 0.72;
    const phase = 0.4 + (n <= 1 ? 0 : (i / (n - 1)) * 0.35);
    const lx = Math.sin(i * freq + phase) * amp;
    const cy = padYTop + radius + i * stepY;
    return { lx, cy };
}

/** 连接各关卡圆心的浅色折线，增强「路线」感（位于圆点下层）。 */
export function drawRouteLine(parent: Node, points: ReadonlyArray<{ lx: number; cy: number }>): void {
    if (points.length < 2) {
        return;
    }
    const line = new Node('routeLine');
    line.layer = Layers.Enum.UI_2D;
    line.addComponent(UITransform).setContentSize(8, 8);
    const g = line.addComponent(Graphics);
    g.lineWidth = 12;
    g.strokeColor = kSelectRouteLine;
    const p0 = points[0]!;
    g.moveTo(p0.lx, -p0.cy);
    for (let k = 1; k < points.length; k++) {
        const p = points[k]!;
        g.lineTo(p.lx, -p.cy);
    }
    g.stroke();
    parent.addChild(line);
    line.setSiblingIndex(0);
}

function resolveDotFillColors(r: LevelRowState, canBuy: boolean): Color {
    if (r.accessible) {
        return kDotPlayable;
    }
    if (canBuy) {
        return kDotBuyable;
    }
    return kDotLocked;
}

function attachCircleFill(parent: Node, radius: number, fill: Color): void {
    const fillN = new Node('fill');
    fillN.layer = Layers.Enum.UI_2D;
    fillN.addComponent(UITransform).setContentSize(radius * 2, radius * 2);
    const fillG = fillN.addComponent(Graphics);
    fillG.fillColor = fill;
    fillG.circle(0, 0, radius - 3);
    fillG.fill();
    parent.addChild(fillN);
}

function attachOptionalIcon(btnN: Node, r: LevelRowState, canBuy: boolean, radius: number): void {
    const iconUrl = r.entry.selectIconUrl?.trim();
    if (!iconUrl) {
        return;
    }
    const innerR = Math.max(12, radius - 8);
    const clip = new Node('iconClip');
    clip.layer = Layers.Enum.UI_2D;
    clip.addComponent(UITransform).setContentSize(innerR * 2, innerR * 2);
    const mask = ccAdd<Mask>(clip, 'Mask');
    mask.type = kEngineMaskTypeGraphicsEllipse;
    const mg = clip.addComponent(Graphics);
    mg.fillColor = kPearlOnColor;
    mg.circle(0, 0, innerR);
    mg.fill();

    const sprN = new Node('icon');
    sprN.layer = Layers.Enum.UI_2D;
    sprN.addComponent(UITransform).setContentSize(innerR * 2, innerR * 2);
    const spr = sprN.addComponent(Sprite);
    spr.sizeMode = Sprite.SizeMode.CUSTOM;
    clip.addChild(sprN);
    btnN.addChild(clip);
    applyRemoteUrlToSprite(spr, iconUrl);
    if (!r.accessible && !canBuy) {
        sprN.addComponent(UIOpacity).opacity = 140;
    }
}

function attachRingOutline(btnN: Node, radius: number, r: LevelRowState, canBuy: boolean): void {
    const ringN = new Node('ring');
    ringN.layer = Layers.Enum.UI_2D;
    ringN.addComponent(UITransform).setContentSize(radius * 2, radius * 2);
    const ringG = ringN.addComponent(Graphics);
    ringG.lineWidth = 5;
    ringG.strokeColor = r.accessible ? kRingPlayable : canBuy ? kRingBuyable : kRingLocked;
    ringG.circle(0, 0, radius - 3);
    ringG.stroke();
    btnN.addChild(ringN);
}

function attachIdStarLabel(btnN: Node, r: LevelRowState, canBuy: boolean, radius: number, onClick: () => void): void {
    const bestStars = PlayerProgressService.getLevelBestStars(r.entry.id);
    const starStr = bestStars > 0 ? '★'.repeat(bestStars) + '☆'.repeat(3 - bestStars) : '☆☆☆';

    const lbN = new Node('txt');
    lbN.layer = Layers.Enum.UI_2D;
    // 勿铺满整圆，否则压盖住角标锁且拦截 Button 点击
    const tw = Math.min(radius * 2 - 8, Math.round(radius * 1.35));
    const th = Math.min(radius * 2 - 8, Math.round(radius * 1.2));
    lbN.addComponent(UITransform).setContentSize(tw, th);
    const lb = lbN.addComponent(Label);
    lb.string = `${r.entry.id}\n${starStr}`;
    lb.fontSize = 36;
    lb.lineHeight = 42;
    lb.horizontalAlign = Label.HorizontalAlign.CENTER;
    lb.verticalAlign = Label.VerticalAlign.CENTER;
    lb.overflow = Label.Overflow.SHRINK;
    lb.color = r.accessible ? kPearlOnColor : canBuy ? kSelectDotLabelBuyable : kSelectDotLabelLocked;
    btnN.addChild(lbN);

    btnN.on(Button.EventType.CLICK, onClick);
}

/** 未解锁且允许金币购买时，在左上角显示阿拉伯数字价格（不与中心关卡号重叠） */
function attachCoinCostChip(btnN: Node, r: LevelRowState, radius: number): void {
    if (r.accessible || r.coinCost <= 0) {
        return;
    }
    const chip = new Node('coinCostChip');
    chip.layer = Layers.Enum.UI_2D;
    chip.setPosition(-radius + 26, radius - 12, 0);
    chip.addComponent(UITransform).setContentSize(64, 34);
    const lb = chip.addComponent(Label);
    lb.string = String(r.coinCost);
    lb.fontSize = 24;
    lb.lineHeight = 30;
    lb.horizontalAlign = Label.HorizontalAlign.CENTER;
    lb.verticalAlign = Label.VerticalAlign.CENTER;
    lb.color = new Color(255, 230, 150, 255);
    btnN.addChild(chip);
}

/**
 * 未解锁圆点右下角锁形标（纯 {@link Graphics} 绘制，避免「锁」字在无中文字体时不显示）。
 */
function attachLockedCornerBadge(btnN: Node, radius: number, r: LevelRowState): void {
    if (r.accessible) {
        return;
    }
    const holder = new Node('lockBadge');
    holder.layer = Layers.Enum.UI_2D;
    const u = Math.max(16, Math.round(radius * 0.38));
    holder.addComponent(UITransform).setContentSize(u * 2.8, u * 2.8);
    holder.setPosition(radius - u * 0.65, -radius + u * 0.72, 0);

    const g = holder.addComponent(Graphics);
    const fillBody = r.coinCost > 0 ? new Color(255, 190, 60, 255) : new Color(168, 160, 175, 255);
    const strokeInk = new Color(52, 40, 48, 255);
    const bodyW = u * 1.2;
    const bodyH = u * 0.92;
    const bx = -bodyW * 0.5;
    const by = -bodyH * 0.55;
    g.fillColor = fillBody;
    g.roundRect(bx, by, bodyW, bodyH, 5);
    g.fill();
    g.lineWidth = 2.5;
    g.strokeColor = strokeInk;
    g.roundRect(bx, by, bodyW, bodyH, 5);
    g.stroke();

    const topY = by + bodyH;
    const shR = u * 0.44;
    g.moveTo(-shR, topY);
    g.lineTo(-shR, topY + u * 0.36);
    g.arc(0, topY + u * 0.36 - shR * 0.12, shR, Math.PI, 0, true);
    g.lineTo(shR, topY);
    g.stroke();

    btnN.addChild(holder);
}

/**
 * 构建曲线上单个关卡圆点（可点按钮 + 填充/描边/可选远程图标 + id 与星数文案）。
 *
 * @param onDotClick 圆点点击时由视图层处理解锁或开局
 */
export function makeCurveLevelDot(
    r: LevelRowState,
    radius: number,
    coins: number,
    onDotClick: () => void,
): Node {
    const diam = radius * 2;
    const dot = new Node(`lvl_${r.entry.id}`);
    dot.layer = Layers.Enum.UI_2D;
    dot.addComponent(UITransform).setContentSize(diam, diam);

    const btnN = new Node('hit');
    btnN.layer = Layers.Enum.UI_2D;
    btnN.addComponent(UITransform).setContentSize(diam, diam);
    const btn = btnN.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 1.08;

    const canBuy = !r.accessible && !r.progressUnlocked && r.coinCost > 0 && coins >= r.coinCost;
    attachCircleFill(btnN, radius, resolveDotFillColors(r, canBuy));
    attachOptionalIcon(btnN, r, canBuy, radius);
    attachRingOutline(btnN, radius, r, canBuy);
    attachCoinCostChip(btnN, r, radius);
    attachLockedCornerBadge(btnN, radius, r);
    attachIdStarLabel(btnN, r, canBuy, radius, onDotClick);

    dot.addChild(btnN);
    return dot;
}

/** 关卡圆点依次弹入的入场动画。 */
export function playLevelDotsEntrance(content: Node): void {
    let idx = 0;
    for (const ch of content.children) {
        if (!ch.name.startsWith('lvl_')) {
            continue;
        }
        ch.setScale(0, 0, 1);
        tween(ch)
            .delay(0.055 * idx + 0.04)
            .to(0.32, { scale: new Vec3(1, 1, 1) }, { easing: easing.backOut })
            .start();
        idx += 1;
    }
}
