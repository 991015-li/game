/**
 * **策划布局 V1**（根级 `Playfield` + `Stack`）解析为运行时 {@link LevelLayoutData}。
 *
 * **职责**：将带设计坐标的桌面牌聚合为**列**、从 `Stack` 拆出**手顶**与**备用堆**；不执行随机发牌。
 *
 * **使用场景**：由 {@link parseLevelLayoutFromJson} 在检测到 {@link isAuthoringV1Root} 为真时调用；
 * 与既有 `hand` + `board.columns` 格式互斥。
 */

import type { LevelLayoutData, ParseLevelLayoutOptions } from './LevelTypes';
import { asObject, coerceLevelId, parseWildLimitFromMeta } from './LevelLayoutShared';
import type { Card } from '../utils/CardEnums';
import { cardKey } from '../utils/CardEnums';

/** 设计坐标 X 聚类阈值（像素）；差值更大则视为新的一列。 */
const kAuthoringPlayfieldColumnBreakGapX = 135;

type PlayfieldCard = { rank: number; suit: number; x: number; y: number };

/**
 * 判断 JSON 根是否为策划 V1（同时存在 `Playfield` 与 `Stack` 数组）。
 *
 * @param root 已收窄的根对象
 */
export function isAuthoringV1Root(root: Record<string, unknown>): boolean {
    return Array.isArray(root.Playfield) && Array.isArray(root.Stack);
}

/**
 * 解析单张牌的 `CardFace`（1–13）与 `CardSuit`（0–3）。
 *
 * @param v 单条 JSON 对象
 * @param err 累积错误信息
 * @returns rank/suit，失败时 `null`
 */
function parseAuthoringFaceSuitItem(v: unknown, err: string[]): { rank: number; suit: number } | null {
    const o = asObject(v);
    if (!o || typeof o.CardFace !== 'number' || typeof o.CardSuit !== 'number') {
        err.push('authoring: CardFace/CardSuit required');
        return null;
    }
    const rank = Math.trunc(o.CardFace);
    const suit = Math.trunc(o.CardSuit);
    if (rank < 1 || rank > 13 || suit < 0 || suit > 3) {
        err.push('authoring: CardFace or CardSuit out of range');
        return null;
    }
    return { rank, suit };
}

/**
 * 读取 `Playfield` 条目的 `Position.x` / `Position.y`。
 *
 * @param item 单条 Playfield
 * @param err 累积错误信息
 */
function parsePlayfieldPosition(item: unknown, err: string[]): { x: number; y: number } | null {
    const o = asObject(item);
    if (!o) {
        err.push('authoring: Playfield entry not object');
        return null;
    }
    const pos = asObject(o.Position);
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
        err.push('authoring: Playfield requires Position { x, y }');
        return null;
    }
    return { x: pos.x, y: pos.y };
}

/**
 * 校验手顶、备用堆与各列之间无重复牌（标准 52 张内唯一）。
 *
 * @param data 即将返回的布局
 * @param err 累积错误信息
 * @returns 是否通过校验
 */
function uniqueAllInLayout(data: LevelLayoutData, err: string[]): boolean {
    const placed = new Set<string>();
    const mark = (c: Card): boolean => {
        const k = cardKey(c);
        if (placed.has(k)) {
            err.push(`layout: duplicate card (${k})`);
            return false;
        }
        placed.add(k);
        return true;
    };
    if (!mark(data.handTop)) {
        return false;
    }
    for (const c of data.stock) {
        if (!mark(c)) {
            return false;
        }
    }
    for (const col of data.columns) {
        for (const c of col) {
            if (!mark(c)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * 从注入选项与 JSON `id` 得到最终关卡号（≥1）。
 *
 * @param root JSON 根
 * @param options 可选关卡号覆盖
 */
function resolveLayoutLevelId(root: Record<string, unknown>, options?: ParseLevelLayoutOptions): number {
    const jsonId = coerceLevelId(root.id);
    const injected = options?.levelId != null ? Math.trunc(options.levelId) : 0;
    const resolvedLevelId = injected > 0 ? injected : jsonId;
    return Math.max(1, resolvedLevelId > 0 ? resolvedLevelId : 1);
}

/**
 * 将 `Playfield` 数组转为带坐标的中转结构。
 *
 * @param playfield JSON 数组
 * @param err 错误收集
 * @returns 失败时 `null`
 */
function collectPlayfieldWithPositions(playfield: unknown[], err: string[]): PlayfieldCard[] | null {
    const pcs: PlayfieldCard[] = [];
    for (const item of playfield) {
        const fs = parseAuthoringFaceSuitItem(item, err);
        const xy = parsePlayfieldPosition(item, err);
        if (!fs || !xy) {
            return null;
        }
        pcs.push({ ...fs, ...xy });
    }
    return pcs;
}

/**
 * 按 X 聚类、列内 Y 升序叠放，仅保留列顶 `faceUp`。
 *
 * @param pcs 带坐标的牌
 */
function buildColumnsFromPlayfield(pcs: PlayfieldCard[]): Card[][] {
    const sorted = [...pcs].sort((a, b) => a.x - b.x);
    const groups: PlayfieldCard[][] = [];
    for (const pc of sorted) {
        const g = groups[groups.length - 1];
        if (!g || Math.abs(pc.x - g[0]!.x) > kAuthoringPlayfieldColumnBreakGapX) {
            groups.push([pc]);
        } else {
            g.push(pc);
        }
    }
    const columns: Card[][] = [];
    for (const g of groups) {
        g.sort((a, b) => a.y - b.y);
        columns.push(
            g.map((p, i) => ({
                rank: p.rank,
                suit: p.suit,
                faceUp: i === g.length - 1,
            })),
        );
    }
    return columns;
}

/**
 * 解析 `Stack`：末张为手顶，前序为备用堆（自下而上，与 `GameModel` 抽牌从末尾一致）。
 *
 * @param stackRaw JSON 数组
 * @param err 错误收集
 */
function parseHandAndStockFromStack(stackRaw: unknown[], err: string[]): { handTop: Card; stock: Card[] } | null {
    const stackCards: Card[] = [];
    for (const item of stackRaw) {
        const fs = parseAuthoringFaceSuitItem(item, err);
        if (!fs) {
            return null;
        }
        stackCards.push({ rank: fs.rank, suit: fs.suit, faceUp: false });
    }
    const top = stackCards[stackCards.length - 1]!;
    const handTop: Card = { rank: top.rank, suit: top.suit, faceUp: true };
    const stock = stackCards.slice(0, -1);
    return { handTop, stock };
}

/**
 * 将策划 V1 根对象解析为 {@link LevelLayoutData}。
 *
 * @param root 根对象（已含 `Playfield` / `Stack`）
 * @param options 可选 `levelId` 注入
 * @returns 成功含 `data`，否则含 `error` 文案
 */
export function parseAuthoringV1Layout(
    root: Record<string, unknown>,
    options?: ParseLevelLayoutOptions,
): { ok: true; data: LevelLayoutData } | { ok: false; error: string } {
    const err: string[] = [];
    const L = resolveLayoutLevelId(root, options);

    const playfield = root.Playfield as unknown[];
    const stackRaw = root.Stack as unknown[];
    if (playfield.length === 0) {
        return { ok: false, error: 'authoring: Playfield must be non-empty' };
    }
    if (stackRaw.length === 0) {
        return { ok: false, error: 'authoring: Stack must be non-empty' };
    }

    const pcs = collectPlayfieldWithPositions(playfield, err);
    if (!pcs) {
        return { ok: false, error: err[0] ?? 'authoring: Playfield parse failed' };
    }

    const columns = buildColumnsFromPlayfield(pcs);
    const hs = parseHandAndStockFromStack(stackRaw, err);
    if (!hs) {
        return { ok: false, error: err[0] ?? 'authoring: Stack parse failed' };
    }

    const data: LevelLayoutData = {
        id: L,
        matchRankMaxDiff: parseWildLimitFromMeta(root),
        handTop: hs.handTop,
        stock: hs.stock,
        columns,
    };

    if (!uniqueAllInLayout(data, err)) {
        return { ok: false, error: err[0] ?? 'authoring: duplicate card' };
    }

    const onTable = 1 + data.stock.length + data.columns.reduce((s, col) => s + col.length, 0);
    if (onTable > 52) {
        return { ok: false, error: 'authoring: total cards exceed 52' };
    }

    return { ok: true, data };
}
