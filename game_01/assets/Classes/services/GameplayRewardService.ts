import { PlayerProgressModel } from '../models/PlayerProgressModel';

/**
 * 局内与经济相关的**业务判定**（是否发奖等），不直接暴露持久化 API。
 */
export class GameplayRewardService {
    /**
     * 吃牌成功时是否向玩家发放「推进新关」的一次性金币（重玩已通关关卡不重复发放）。
     *
     * @param levelId 当前对局关卡 id
     * @returns `levelId` 严格大于 {@link PlayerProgressModel.getMaxClearedLevelId} 的历史值时为 `true`
     */
    static shouldAwardMatchCoins(levelId: number): boolean {
        if (!Number.isFinite(levelId) || levelId <= 0) {
            return false;
        }
        return levelId > PlayerProgressModel.getMaxClearedLevelId();
    }
}
