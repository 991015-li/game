import { PlayerProgressModel } from '../models/PlayerProgressModel';

/**
 * 玩家进度**访问门面**（仅静态方法，无实例成员）。
 *
 * **用途**：供 UI、控制器等读写本地持久化的通关进度、评星、金币与道具库存；全部委托 {@link PlayerProgressModel}，自身不缓存。
 *
 * **分层**：业务层应通过本类访问存档，避免直接依赖模型实现。
 */
export class PlayerProgressService {
    /**
     * 读取历史最高「已通关」关卡 id；无存档时为 `0`。
     *
     * @returns 非负整数关卡 id
     */
    static getMaxClearedLevelId(): number {
        return PlayerProgressModel.getMaxClearedLevelId();
    }

    /**
     * 覆盖写入已通关的最大关卡 id。
     *
     * @param levelId 关卡 id（通常为自然数）
     */
    static setMaxClearedLevelId(levelId: number): void {
        PlayerProgressModel.setMaxClearedLevelId(levelId);
    }

    /**
     * 若本次 `levelId` 高于历史记录则更新存储。
     *
     * @param levelId 本次结算对应的关卡 id
     */
    static recordLevelClearedIfBetter(levelId: number): void {
        PlayerProgressModel.recordLevelClearedIfBetter(levelId);
    }

    /**
     * 读取某关历史最高星数。
     *
     * @param levelId 关卡 id
     * @returns 范围 `0`～`3`；无记录时为 `0`
     */
    static getLevelBestStars(levelId: number): number {
        return PlayerProgressModel.getLevelBestStars(levelId);
    }

    /**
     * 若本次星数高于该关历史记录则写入。
     *
     * @param levelId 关卡 id
     * @param stars 本次星数（会钳制到 `0`～`3`）
     */
    static recordLevelStarsIfBetter(levelId: number, stars: number): void {
        PlayerProgressModel.recordLevelStarsIfBetter(levelId, stars);
    }

    /**
     * 当前金币余额（不致负）。
     *
     * @returns 非负整数
     */
    static getCoins(): number {
        return PlayerProgressModel.getCoins();
    }

    /**
     * 增减金币；结果余额钳制在 `[0, +∞)`。
     *
     * @param delta 正为收入，负为支出
     */
    static addCoins(delta: number): void {
        PlayerProgressModel.addCoins(delta);
    }

    /**
     * 曾用金币永久解锁的关卡 id 集合（与通关进度独立存储）。
     *
     * @returns 只读集合，元素为已解锁关卡 id
     */
    static getCoinUnlockedLevelIds(): ReadonlySet<number> {
        return PlayerProgressModel.getCoinUnlockedLevelIds();
    }

    /**
     * 将关卡标记为金币解锁（应在扣费成功后调用）。
     *
     * @param levelId 关卡 id
     */
    static addCoinUnlockedLevel(levelId: number): void {
        PlayerProgressModel.addCoinUnlockedLevel(levelId);
    }

    /**
     * 商店购买/持久化的「提示」道具库存（局内先于当场扣金消耗）。
     *
     * @returns 非负整数次数
     */
    static getPropInventoryHint(): number {
        return PlayerProgressModel.getPropInventoryHint();
    }

    /**
     * 商店购买/持久化的「加时」道具库存。
     *
     * @returns 非负整数次数
     */
    static getPropInventoryTime(): number {
        return PlayerProgressModel.getPropInventoryTime();
    }

    /**
     * 增减「提示」道具库存（结果钳制 `≥ 0`）。
     *
     * @param delta 正为购买等增加，负为局内消耗
     */
    static addPropInventoryHint(delta: number): void {
        PlayerProgressModel.addPropInventoryHint(delta);
    }

    /**
     * 增减「加时」道具库存（结果钳制 `≥ 0`）。
     *
     * @param delta 正为购买等增加，负为局内消耗
     */
    static addPropInventoryTime(delta: number): void {
        PlayerProgressModel.addPropInventoryTime(delta);
    }

    /**
     * 商店购买/持久化的「短补」道具库存。
     *
     * @returns 非负整数次数
     */
    static getPropInventorySmallTime(): number {
        return PlayerProgressModel.getPropInventorySmallTime();
    }

    /**
     * 增减「短补」道具库存（结果钳制 `≥ 0`）。
     *
     * @param delta 正为购买等增加，负为局内消耗
     */
    static addPropInventorySmallTime(delta: number): void {
        PlayerProgressModel.addPropInventorySmallTime(delta);
    }

    /**
     * 商店购买/持久化的「亮顶」道具库存。
     *
     * @returns 非负整数次数
     */
    static getPropInventoryReveal(): number {
        return PlayerProgressModel.getPropInventoryReveal();
    }

    /**
     * 增减「亮顶」道具库存（结果钳制 `≥ 0`）。
     *
     * @param delta 正为购买等增加，负为局内消耗
     */
    static addPropInventoryReveal(delta: number): void {
        PlayerProgressModel.addPropInventoryReveal(delta);
    }

    /**
     * 商店购买/持久化的「洗背」道具库存。
     *
     * @returns 非负整数次数
     */
    static getPropInventoryShuffleStock(): number {
        return PlayerProgressModel.getPropInventoryShuffleStock();
    }

    /**
     * 增减「洗背」道具库存（结果钳制 `≥ 0`）。
     *
     * @param delta 正为购买等增加，负为局内消耗
     */
    static addPropInventoryShuffleStock(delta: number): void {
        PlayerProgressModel.addPropInventoryShuffleStock(delta);
    }

    /**
     * 历史「强抽」道具库存（存档字段；当前玩法若已弃用仍可读取旧数据）。
     *
     * @returns 非负整数次数
     */
    static getPropInventoryDraw(): number {
        return PlayerProgressModel.getPropInventoryDraw();
    }

    /**
     * 增减「强抽」道具库存（结果钳制 `≥ 0`）。
     *
     * @param delta 正为增加，负为减少
     */
    static addPropInventoryDraw(delta: number): void {
        PlayerProgressModel.addPropInventoryDraw(delta);
    }
}
