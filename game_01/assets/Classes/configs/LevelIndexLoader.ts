import type { LevelIndexData, LevelIndexEntry } from './LevelTypes';

function asObject(value: unknown): Record<string, unknown> | null {
    return value != null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}

/**
 * 将关卡列表 JSON（`level_index`）解析为强类型 {@link LevelIndexData}。
 *
 * @param doc 原始 JSON 反序列化对象
 * @returns 成功则带 `data`；否则带 `error` 说明
 */
export function parseLevelIndexFromJson(doc: unknown): { ok: true; data: LevelIndexData } | { ok: false; error: string } {
    const root = asObject(doc);
    if (!root) {
        return { ok: false, error: 'level_index: invalid json' };
    }
    const data: LevelIndexData = { version: asNumber(root.version, 1), levels: [] };
    if (!Array.isArray(root.levels)) {
        return { ok: false, error: 'level_index: missing levels' };
    }
    const rawLevels = root.levels;
    for (let i = 0; i < rawLevels.length; i++) {
        const item = rawLevels[i];
        const itemObj = asObject(item);
        if (!itemObj) {
            return { ok: false, error: `level_index: levels[${i}] must be object` };
        }

        const unlockObj = asObject(itemObj.unlock);
        const entry: LevelIndexEntry = {
            id: asNumber(itemObj.id, 0),
            name: asString(itemObj.name, ''),
            file: asString(itemObj.file, ''),
            chapter: asNumber(itemObj.chapter, 0),
            order: asNumber(itemObj.order, 0),
            unlockType: asString(unlockObj?.type, ''),
            prevId: asNumber(unlockObj?.prevId, 0),
        };
        if (entry.id <= 0) {
            return { ok: false, error: `level_index: levels[${i}].id must be positive` };
        }
        if (entry.file.trim().length === 0) {
            return { ok: false, error: `level_index: levels[${i}].file required` };
        }
        const iconRaw = itemObj.selectIconUrl;
        if (typeof iconRaw === 'string' && iconRaw.trim().length > 0) {
            entry.selectIconUrl = iconRaw.trim();
        }
        const coinCostRaw = itemObj.unlockCoinCost;
        if (coinCostRaw !== undefined) {
            entry.unlockCoinCost = asNumber(coinCostRaw, 0);
        }
        data.levels.push(entry);
    }
    if (data.levels.length === 0 && rawLevels.length > 0) {
        return { ok: false, error: 'level_index: no valid level entries' };
    }
    return { ok: true, data };
}
