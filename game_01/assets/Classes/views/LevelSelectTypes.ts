import type { LevelIndexEntry } from '../configs/LevelTypes';

/** 单关行在选关列表中的运行时状态（解锁判定结果），供圆点构建与点击逻辑共用。 */
export type LevelRowState = {
    entry: LevelIndexEntry;
    /** 当前是否可进入（进度或金币解锁） */
    accessible: boolean;
    /** 是否仅凭通关进度即可进入 */
    progressUnlocked: boolean;
    coinCost: number;
};
