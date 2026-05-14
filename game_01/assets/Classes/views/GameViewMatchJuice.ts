import { Color, Node, Vec3 } from 'cc';
import { kCoinsPerSuccessfulMatch } from '../configs/EconomyConfig';
import { hintsForMatchStreak } from '../services/MatchComboPresentationService';
import { spawnSparkleBurst } from './MatchPresentationVfx';
import { juicePopScale, spawnFloaterLabel } from '../utils/JuiceTweens';
import { kHandTopNodeName } from './GameViewBoardRefresh';

/**
 * 吃牌后的短时反馈：**连击飘字**、星光、手牌缩放与「桌面要清啦」提示（纯表现，不改模型）。
 */

/**
 * 统计主牌区剩余张数（用于临近清板提示）。
 *
 * @param columns 各列牌栈
 * @returns 总张数
 */
export function countBoardCards(columns: ReadonlyArray<ReadonlyArray<unknown>>): number {
    let n = 0;
    for (const c of columns) {
        n += c.length;
    }
    return n;
}

export interface MatchJuiceContext {
    /** 对局 shell 根 */
    root: Node;
    handLayer: Node | null;
    /** 手牌区域局部坐标（飘字锚点） */
    handLocal: Vec3;
    /** 是否展示 +金币 飘字 */
    withCoinFx: boolean;
    matchStreak: number;
    /** 吃牌后主牌区剩余张数 */
    boardCardsLeft: number;
    nearWinCheerShown: boolean;
}

export interface MatchJuiceOutcome {
    /** 是否已在临近清板时播过提示（供下次调用防重复） */
    nearWinCheerShown: boolean;
}

/**
 * 吃牌后的飘字、星光、手牌缩放与冲刺提示。
 *
 * @param ctx 上下文
 * @returns 更新后的「临近清板是否已提示」标记
 */
export function playMatchJuiceEffects(ctx: MatchJuiceContext): MatchJuiceOutcome {
    let nearWinCheerShown = ctx.nearWinCheerShown;
    const handTop = ctx.handLayer?.getChildByName(kHandTopNodeName);
    const combo = hintsForMatchStreak(ctx.matchStreak);

    if (combo?.floater) {
        const pc = ctx.handLocal.clone();
        pc.y += 50 + (ctx.matchStreak >= 3 ? 10 : 0);
        spawnFloaterLabel(ctx.root, pc, combo.floater.text, combo.floater.color);
    }
    if (combo?.sparkles) {
        const sp = ctx.handLocal.clone();
        sp.y += 6;
        spawnSparkleBurst(ctx.root, sp);
    }

    let handPeak = combo?.handPopPeak;
    if (ctx.withCoinFx) {
        const p = ctx.handLocal.clone();
        p.y += 38;
        spawnFloaterLabel(ctx.root, p, `+${kCoinsPerSuccessfulMatch} 金币`, new Color(255, 226, 120, 255));
        handPeak = handPeak == null ? 1.1 : Math.max(handPeak, 1.1);
    } else if (handPeak == null) {
        handPeak = 1.06;
    }
    if (handTop) {
        juicePopScale(handTop, handPeak ?? 1.06);
    }

    const left = ctx.boardCardsLeft;
    if (left > 0 && left <= 3 && !nearWinCheerShown) {
        nearWinCheerShown = true;
        const p2 = ctx.handLocal.clone();
        p2.y += 90;
        spawnFloaterLabel(ctx.root, p2, '桌面要清啦', new Color(198, 228, 205, 255));
    }

    return { nearWinCheerShown };
}
