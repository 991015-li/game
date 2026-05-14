/**
 * 将单关布局 JSON 解析为 {@link LevelLayoutData} 的**主入口模块**。
 *
 * **职责**：分发两种根格式——策划 V1（`Playfield`+`Stack`）与既有列式+随机发牌；校验去重；对既有格式应用渐进翻面。
 *
 * **使用场景**：{@link GamePlayController#loadLevel} 读取 resources 下关卡 JSON 后调用 {@link parseLevelLayoutFromJson}。
 *
 * **非职责**：坐标驱动的绝对摆牌（V1 仅把坐标用于聚列）；具体玩法规则见 {@link GameLogicManager}。
 */

import { dealTotalCardsForLevel } from './DesignLayout';
import { parseAuthoringV1Layout, isAuthoringV1Root } from './LevelLayoutAuthoringV1';
import { asObject, coerceLevelId, parseWildLimitFromMeta } from './LevelLayoutShared';
import type { LevelLayoutData, ParseLevelLayoutOptions } from './LevelTypes';
import type { Card } from '../utils/CardEnums';
import { cardKey, createStandardDeckFaceDown, parseSuitLetter, shuffleArrayInPlace } from '../utils/CardEnums';

export type { ParseLevelLayoutOptions } from './LevelTypes';

/**
 * 解析既有格式中的单张牌（`rank` + 字母 `suit` + `faceUp`）。
 *
 * @param v JSON 对象
 * @param errOut 错误信息收集
 */
function parseCard(v: unknown, errOut: string[]): Card | null {
    const cardObj = asObject(v);
    if (!cardObj) {
        errOut.push('card: not object');
        return null;
    }
    if (typeof cardObj.rank !== 'number' || typeof cardObj.suit !== 'string' || typeof cardObj.faceUp !== 'boolean') {
        errOut.push('card: bad fields');
        return null;
    }
    const suit = parseSuitLetter(cardObj.suit);
    if (suit == null) {
        errOut.push('card: suit');
        return null;
    }
    return { rank: cardObj.rank, suit, faceUp: cardObj.faceUp };
}

/**
 * 读取根上 `hand.initialTop`。
 *
 * @param root JSON 根
 * @param err 错误收集
 */
function parseHandTop(root: Record<string, unknown>, err: string[]): Card | null {
    const hand = asObject(root.hand);
    if (!hand) {
        return null;
    }
    return parseCard(hand.initialTop, err);
}

/**
 * 读取 `board.columns[].stack` 为二维列数组。
 *
 * @param root JSON 根
 * @param err 错误收集
 */
function parseColumns(root: Record<string, unknown>, err: string[]): Card[][] | null {
    const board = asObject(root.board);
    if (!board || !Array.isArray(board.columns)) {
        return null;
    }
    const columns: Card[][] = [];
    for (const colObj of board.columns) {
        const colData = asObject(colObj);
        if (!colData || !Array.isArray(colData.stack)) {
            return null;
        }
        const stack: Card[] = [];
        for (const c of colData.stack) {
            const pc = parseCard(c, err);
            if (!pc) {
                return null;
            }
            stack.push(pc);
        }
        columns.push(stack);
    }
    return columns;
}

/**
 * 校验手顶与各列中牌键唯一（不含备用堆）。
 *
 * @param data 中间布局
 * @param err 错误收集
 */
function uniquePlacedSet(data: LevelLayoutData, err: string[]): Set<string> | null {
    const placed = new Set<string>();
    const markPlaced = (c: Card): boolean => {
        const k = cardKey(c);
        if (placed.has(k)) {
            err.push(`layout: duplicate card in play area (${k})`);
            return false;
        }
        placed.add(k);
        return true;
    };
    if (!markPlaced(data.handTop)) {
        return null;
    }
    for (const col of data.columns) {
        for (const c of col) {
            if (!markPlaced(c)) {
                return null;
            }
        }
    }
    return placed;
}

/**
 * 随关卡 id 提高，从列顶向下多翻若干张（覆盖 JSON `faceUp`）。
 *
 * @param data 已随机发牌后的布局（就地修改）
 */
function applyProgressiveFaceUpForLevel(data: LevelLayoutData): void {
    const L = Math.max(1, data.id);
    const visibleFromTop = (stackLen: number): number => {
        const k = Math.max(1, 1 + Math.ceil((L - 1) * 0.65));
        return Math.min(stackLen, k);
    };
    for (const col of data.columns) {
        if (col.length === 0) {
            continue;
        }
        const k = visibleFromTop(col.length);
        for (let i = 0; i < col.length; i++) {
            const depthFromTop = col.length - 1 - i;
            col[i]!.faceUp = depthFromTop < k;
        }
    }
}

/**
 * 用洗好的前 `totalCards` 张牌，按槽位写入各列、手顶与备用堆（就地修改 `data`）。
 *
 * @param data 布局（列结构已固定，牌值待覆盖）
 * @param totalCards 本局参与牌数上限
 * @returns 成功或错误原因
 */
function applyRandomDealFromStandardDeck(data: LevelLayoutData, totalCards: number): { ok: true } | { ok: false; error: string } {
    let onTable = 1;
    for (const col of data.columns) {
        onTable += col.length;
    }
    const stockCount = totalCards - onTable;
    if (stockCount < 0) {
        return {
            ok: false,
            error: `layout: 桌上需牌 ${onTable} 张，超过每局发牌上限 ${totalCards}`,
        };
    }

    const deck = createStandardDeckFaceDown();
    shuffleArrayInPlace(deck);
    const pool = deck.slice(0, totalCards);
    let pi = 0;

    for (const col of data.columns) {
        for (let i = 0; i < col.length; i++) {
            const c = pool[pi++]!;
            col[i]!.rank = c.rank;
            col[i]!.suit = c.suit;
        }
    }
    {
        const c = pool[pi++]!;
        data.handTop.rank = c.rank;
        data.handTop.suit = c.suit;
    }

    const stock: Card[] = [];
    for (let s = 0; s < stockCount; s++) {
        const c = pool[pi++]!;
        stock.push({ rank: c.rank, suit: c.suit, faceUp: false });
    }

    if (pi !== totalCards) {
        return { ok: false, error: 'layout: internal deal count mismatch' };
    }

    data.stock = stock;
    return { ok: true };
}

/**
 * 解析关卡布局 JSON（策划 V1 或既有格式）。
 *
 * @param doc 任意 JSON 根
 * @param options 可选 {@link ParseLevelLayoutOptions#levelId} 注入
 * @returns `ok: true` 时含 `data`；否则含 `error`
 */
export function parseLevelLayoutFromJson(
    doc: unknown,
    options?: ParseLevelLayoutOptions,
): { ok: true; data: LevelLayoutData } | { ok: false; error: string } {
    const root = asObject(doc);
    if (!root) {
        return { ok: false, error: 'layout: invalid json' };
    }
    if (isAuthoringV1Root(root)) {
        return parseAuthoringV1Layout(root, options);
    }

    const err: string[] = [];
    const jsonId = coerceLevelId(root.id);
    const injected = options?.levelId != null ? Math.trunc(options.levelId) : 0;
    const resolvedLevelId = injected > 0 ? injected : jsonId;
    const L = Math.max(1, resolvedLevelId > 0 ? resolvedLevelId : 1);

    const data: LevelLayoutData = {
        id: L,
        matchRankMaxDiff: parseWildLimitFromMeta(root),
        handTop: { rank: 1, suit: 0, faceUp: true },
        stock: [],
        columns: [],
    };
    const handTop = parseHandTop(root, err);
    if (!handTop) {
        return { ok: false, error: err[0] ?? 'layout: missing hand' };
    }
    data.handTop = handTop;
    const columns = parseColumns(root, err);
    if (!columns) {
        return { ok: false, error: err[0] ?? 'layout: missing columns' };
    }
    data.columns = columns;

    const placed = uniquePlacedSet(data, err);
    if (!placed) {
        return { ok: false, error: err[0] ?? 'layout: duplicate' };
    }

    data.stock = createStandardDeckFaceDown().filter((c) => !placed.has(cardKey(c)));
    if (data.stock.length + placed.size !== 52) {
        return { ok: false, error: 'layout: play area must use subset of standard 52 cards' };
    }

    const deal = applyRandomDealFromStandardDeck(data, dealTotalCardsForLevel(L));
    if (deal.ok === false) {
        return { ok: false, error: deal.error };
    }
    applyProgressiveFaceUpForLevel(data);

    return { ok: true, data };
}
