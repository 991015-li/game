import { sys } from 'cc';

const kMaxClearedLevelStorageKey = 'cc_max_cleared_level_id';
const kLevelBestStarsStorageKey = 'cc_level_best_stars_v1';
const kPlayerCoinsStorageKey = 'cc_player_coins_v1';
const kCoinUnlockedLevelsKey = 'cc_levels_coin_unlocked_v1';
const kPropInventoryHintKey = 'cc_prop_inv_hint_v1';
const kPropInventoryTimeKey = 'cc_prop_inv_time_v1';
const kPropInventorySmallTimeKey = 'cc_prop_inv_stime_v1';
const kPropInventoryRevealKey = 'cc_prop_inv_reveal_v1';
const kPropInventoryShuffleStockKey = 'cc_prop_inv_shuffle_v1';
const kPropInventoryDrawKey = 'cc_prop_inv_draw_v1';

/**
 * 玩家进度持久化（本地存储）。
 *
 * **职责**：通关进度、评星、金币、道具库存与金币解锁关卡的 **持久化**；**不**含单局牌面、
 * **不**含发奖等业务规则（规则见 {@link GameplayRewardService}；对外读写见 {@link PlayerProgressService}）。
 *
 * **使用场景**：由 {@link PlayerProgressService} 统一委托；业务/UI 禁止直接 import 本类。
 */
export class PlayerProgressModel {
    /**
     * 读取已通关的最大关卡 id；无存档时为 0。
     *
     * @returns 非负整数
     */
    static getMaxClearedLevelId(): number {
        const v = sys.localStorage.getItem(kMaxClearedLevelStorageKey);
        if (v == null || v === '') return 0;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : 0;
    }

    /**
     * 写入已通关的最大关卡 id（覆盖）。
     * @param levelId 关卡 id
     */
    static setMaxClearedLevelId(levelId: number): void {
        sys.localStorage.setItem(kMaxClearedLevelStorageKey, String(levelId));
    }

    /**
     * 若当前通关关卡优于历史记录则更新存储。
     * @param levelId 本次完成的关卡 id
     */
    static recordLevelClearedIfBetter(levelId: number): void {
        const cur = PlayerProgressModel.getMaxClearedLevelId();
        if (levelId > cur) {
            PlayerProgressModel.setMaxClearedLevelId(levelId);
        }
    }

    /**
     * 读取某关历史最高星数（0～3）。
     *
     * @param levelId 关卡 id
     * @returns 范围 `0`～`3`；无记录为 `0`
     */
    static getLevelBestStars(levelId: number): number {
        const map = PlayerProgressModel._readStarsMap();
        const n = map[String(levelId)];
        return n != null && n >= 0 && n <= 3 ? n : 0;
    }

    /**
     * 若本次星数高于该关历史记录则落盘。
     *
     * @param levelId 关卡 id
     * @param stars 本次星数（会钳到 `0`～`3`）
     * @returns void
     */
    static recordLevelStarsIfBetter(levelId: number, stars: number): void {
        const clamped = Math.max(0, Math.min(3, Math.floor(stars)));
        const map = PlayerProgressModel._readStarsMap();
        const key = String(levelId);
        const prev = map[key] ?? 0;
        if (clamped > prev) {
            map[key] = clamped;
            PlayerProgressModel._writeStarsMap(map);
        }
    }

    /**
     * 从本地 JSON 读取评星映射。
     *
     * @returns 关卡 id 字符串 → 星数
     */
    private static _readStarsMap(): Record<string, number> {
        const raw = sys.localStorage.getItem(kLevelBestStarsStorageKey);
        if (raw == null || raw === '') {
            return {};
        }
        try {
            const o = JSON.parse(raw) as unknown;
            if (o == null || typeof o !== 'object') {
                return {};
            }
            const src = o as Record<string, unknown>;
            const out: Record<string, number> = {};
            for (const k of Object.keys(src)) {
                const v = src[k];
                const n = typeof v === 'number' ? v : parseInt(String(v), 10);
                if (Number.isFinite(n) && n >= 0 && n <= 3) {
                    out[k] = n;
                }
            }
            return out;
        } catch {
            return {};
        }
    }

    /**
     * 写回评星映射 JSON。
     *
     * @param map 关卡 id 字符串 → 星数
     * @returns void
     */
    private static _writeStarsMap(map: Record<string, number>): void {
        sys.localStorage.setItem(kLevelBestStarsStorageKey, JSON.stringify(map));
    }

    /**
     * 当前金币余额（不致负）。
     *
     * @returns 非负整数
     */
    static getCoins(): number {
        const v = sys.localStorage.getItem(kPlayerCoinsStorageKey);
        if (v == null || v === '') {
            return 0;
        }
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    /**
     * 增加或减少金币；结果余额钳制在 [0, +∞)。
     * @param delta 正为奖励，负为消费或撤销回退
     */
    static addCoins(delta: number): void {
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }
        const next = Math.max(0, PlayerProgressModel.getCoins() + Math.trunc(delta));
        sys.localStorage.setItem(kPlayerCoinsStorageKey, String(next));
    }

    /**
     * @returns 曾用金币永久解锁的关卡 id 集合（与通关进度独立存储）
     */
    static getCoinUnlockedLevelIds(): ReadonlySet<number> {
        const raw = sys.localStorage.getItem(kCoinUnlockedLevelsKey);
        if (raw == null || raw === '') {
            return new Set();
        }
        try {
            const o = JSON.parse(raw) as unknown;
            if (!Array.isArray(o)) {
                return new Set();
            }
            const out = new Set<number>();
            for (const x of o) {
                const n = typeof x === 'number' ? x : parseInt(String(x), 10);
                if (Number.isFinite(n) && n > 0) {
                    out.add(n);
                }
            }
            return out;
        } catch {
            return new Set();
        }
    }

    /**
     * 将关卡标记为金币永久解锁（应已扣费后调用）。
     *
     * @param levelId 关卡 id
     * @returns void
     */
    static addCoinUnlockedLevel(levelId: number): void {
        if (!Number.isFinite(levelId) || levelId <= 0) {
            return;
        }
        const cur = PlayerProgressModel.getCoinUnlockedLevelIds();
        if (cur.has(levelId)) {
            return;
        }
        const next = new Set(cur);
        next.add(levelId);
        PlayerProgressModel._writeCoinUnlockedSet(next);
    }

    /**
     * 持久化金币解锁关卡 id 集合。
     *
     * @param ids 关卡 id 集合
     * @returns void
     */
    private static _writeCoinUnlockedSet(ids: Set<number>): void {
        sys.localStorage.setItem(kCoinUnlockedLevelsKey, JSON.stringify(Array.from(ids.values()).sort((a, b) => a - b)));
    }

    /**
     * 商店持久化的「提示」库存。
     *
     * @returns 非负整数次数
     */
    static getPropInventoryHint(): number {
        const v = sys.localStorage.getItem(kPropInventoryHintKey);
        if (v == null || v === '') {
            return 0;
        }
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    /**
     * 在选关商店购买的额外「加时」次数；对局内先于当场扣金消耗。
     *
     * @returns 非负整数库存
     */
    static getPropInventoryTime(): number {
        const v = sys.localStorage.getItem(kPropInventoryTimeKey);
        if (v == null || v === '') {
            return 0;
        }
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    /**
     * 增减「提示」库存（结果钳制 `≥ 0`）。
     *
     * @param delta 正为购买等增加，负为消耗
     * @returns void
     */
    static addPropInventoryHint(delta: number): void {
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }
        const next = Math.max(0, PlayerProgressModel.getPropInventoryHint() + Math.trunc(delta));
        sys.localStorage.setItem(kPropInventoryHintKey, String(next));
    }

    /**
     * 增减「加时」道具库存（结果钳制在 ≥0）。
     *
     * @param delta 正为商店购买等增加，负为消耗
     */
    static addPropInventoryTime(delta: number): void {
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }
        const next = Math.max(0, PlayerProgressModel.getPropInventoryTime() + Math.trunc(delta));
        sys.localStorage.setItem(kPropInventoryTimeKey, String(next));
    }

    /**
     * 商店持久化的「短补」库存。
     *
     * @returns 非负整数次数
     */
    static getPropInventorySmallTime(): number {
        const v = sys.localStorage.getItem(kPropInventorySmallTimeKey);
        if (v == null || v === '') {
            return 0;
        }
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    /**
     * 增减「短补」道具库存。
     *
     * @param delta 正负整数偏移
     */
    static addPropInventorySmallTime(delta: number): void {
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }
        const next = Math.max(0, PlayerProgressModel.getPropInventorySmallTime() + Math.trunc(delta));
        sys.localStorage.setItem(kPropInventorySmallTimeKey, String(next));
    }

    /**
     * 商店持久化的「亮顶」库存。
     *
     * @returns 非负整数次数
     */
    static getPropInventoryReveal(): number {
        const v = sys.localStorage.getItem(kPropInventoryRevealKey);
        if (v == null || v === '') {
            return 0;
        }
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    /**
     * 增减「亮顶」库存（结果钳制 `≥ 0`）。
     *
     * @param delta 正为购买等增加，负为消耗
     * @returns void
     */
    static addPropInventoryReveal(delta: number): void {
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }
        const next = Math.max(0, PlayerProgressModel.getPropInventoryReveal() + Math.trunc(delta));
        sys.localStorage.setItem(kPropInventoryRevealKey, String(next));
    }

    /**
     * 商店持久化的「洗背」库存。
     *
     * @returns 非负整数次数
     */
    static getPropInventoryShuffleStock(): number {
        const v = sys.localStorage.getItem(kPropInventoryShuffleStockKey);
        if (v == null || v === '') {
            return 0;
        }
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    /**
     * 增减「洗背」库存（结果钳制 `≥ 0`）。
     *
     * @param delta 正为购买等增加，负为消耗
     * @returns void
     */
    static addPropInventoryShuffleStock(delta: number): void {
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }
        const next = Math.max(0, PlayerProgressModel.getPropInventoryShuffleStock() + Math.trunc(delta));
        sys.localStorage.setItem(kPropInventoryShuffleStockKey, String(next));
    }

    /**
     * 历史「强抽」库存（存档字段；玩法若已弃用仍可读）。
     *
     * @returns 非负整数次数
     */
    static getPropInventoryDraw(): number {
        const v = sys.localStorage.getItem(kPropInventoryDrawKey);
        if (v == null || v === '') {
            return 0;
        }
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    /**
     * 增减「强抽」道具库存。
     *
     * @param delta 正负整数偏移
     */
    static addPropInventoryDraw(delta: number): void {
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }
        const next = Math.max(0, PlayerProgressModel.getPropInventoryDraw() + Math.trunc(delta));
        sys.localStorage.setItem(kPropInventoryDrawKey, String(next));
    }
}
