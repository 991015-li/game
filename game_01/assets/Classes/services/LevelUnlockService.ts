import type { LevelIndexEntry } from '../configs/LevelTypes';

/** 未在 JSON 指定 {@link LevelIndexEntry.unlockCoinCost} 时：第 2 关起基础价与每升一关的递增步长 */
const kDefaultCoinUnlockBase = 52;
const kDefaultCoinUnlockPerOrderStep = 30;

/**
 * 关卡解锁规则（无状态）：根据进度快照与条目配置判断是否可选（进度数值来自存档）。
 *
 * **职责**：纯规则判断；**不**扣金币、**不**写存档。开局扣费由入口脚本在调用 `PlayerProgressService` 时完成。
 *
 * **使用场景**：`LevelSelectView` 与 `GameBootstrap` 在渲染/门禁前计算可玩状态。
 */
export class LevelUnlockService {
    /**
     * @param entry 关卡索引条目
     * @param maxClearedLevelId 历史最大已通关 id
     * @returns 是否**仅按通关进度**即可进入（不含金币解锁）
     */
    static isLevelUnlockedByProgress(entry: LevelIndexEntry, maxClearedLevelId: number): boolean {
        if (entry.id <= 1) {
            return true;
        }
        if (entry.unlockType === 'prev_cleared') {
            return maxClearedLevelId >= entry.prevId;
        }
        return maxClearedLevelId >= entry.id - 1;
    }

    /**
     * @deprecated 使用 {@link LevelUnlockService.isLevelUnlockedByProgress}；保留别名以兼容旧调用。
     * @param entry 关卡索引条目
     * @param maxClearedLevelId 历史最大已通关 id
     * @returns 与 {@link LevelUnlockService.isLevelUnlockedByProgress} 相同
     */
    static isLevelUnlocked(entry: LevelIndexEntry, maxClearedLevelId: number): boolean {
        return LevelUnlockService.isLevelUnlockedByProgress(entry, maxClearedLevelId);
    }

    /**
     * 是否可进入本关：满足进度解锁，或本关已被金币解锁。
     *
     * @param entry 关卡索引条目
     * @param maxClearedLevelId 历史最大已通关 id
     * @param coinUnlockedIds 已用金币永久解锁的关卡 id 集合
     * @returns 玩家是否可点击圆点进入或购买
     *
     * @remarks **可进入**与**通关是否推高主线进度**不同：仅当入局时已满足 {@link LevelUnlockService.isLevelUnlockedByProgress}
     * 时，胜利才会写入更高的已通最大关卡 id；仅凭金币解锁入局时通关只记星级，不改变邻关进度锁。
     */
    static canAccessLevel(entry: LevelIndexEntry, maxClearedLevelId: number, coinUnlockedIds: ReadonlySet<number>): boolean {
        if (LevelUnlockService.isLevelUnlockedByProgress(entry, maxClearedLevelId)) {
            return true;
        }
        return coinUnlockedIds.has(entry.id);
    }

    /**
     * 金币解锁价；`0` 表示不可通过金币购买早鸟解锁。
     * 未配置时按关卡 {@link LevelIndexEntry.order} **阶梯递增**：第 2 关 `base`，第 3 关 `base+step`，依此类推。
     *
     * @param entry 关卡索引条目
     * @returns 非负整数金币数
     */
    static getUnlockCoinCost(entry: LevelIndexEntry): number {
        if (entry.id <= 1) {
            return 0;
        }
        if (entry.unlockCoinCost !== undefined) {
            return Math.max(0, Math.floor(entry.unlockCoinCost));
        }
        const orderRank = entry.order >= 2 ? entry.order : Math.max(2, entry.id);
        const tier = Math.max(0, orderRank - 2);
        return kDefaultCoinUnlockBase + tier * kDefaultCoinUnlockPerOrderStep;
    }
}
