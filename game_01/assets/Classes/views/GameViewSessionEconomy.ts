import { PlayerProgressService } from '../services/PlayerProgressService';

/**
 * 进入关卡时的经济快照与**未通关放弃**时的回滚（金币 + 五种道具库存）。
 */

/** 进入关卡时的经济快照（用于未通关回退） */
export interface LevelStartEconomySnapshot {
    coins: number;
    hintInv: number;
    timeInv: number;
    smallTimeInv: number;
    revealInv: number;
    shuffleStockInv: number;
}

/**
 * 从当前存档读取进入本关前应恢复的基准。
 *
 * @returns 不可变快照结构
 */
export function takeLevelStartEconomySnapshot(): LevelStartEconomySnapshot {
    return {
        coins: PlayerProgressService.getCoins(),
        hintInv: PlayerProgressService.getPropInventoryHint(),
        timeInv: PlayerProgressService.getPropInventoryTime(),
        smallTimeInv: PlayerProgressService.getPropInventorySmallTime(),
        revealInv: PlayerProgressService.getPropInventoryReveal(),
        shuffleStockInv: PlayerProgressService.getPropInventoryShuffleStock(),
    };
}

/**
 * 将金币与五种道具库存恢复为进入关卡时的快照，并刷新 UI。
 *
 * @param snap {@link takeLevelStartEconomySnapshot}
 * @param after 回滚后刷新顶栏与包裹文案
 */
export function restoreEconomyToSnapshot(
    snap: LevelStartEconomySnapshot,
    after: { refreshCoinHud: () => void; refreshBagTexts: () => void },
): void {
    const curCoins = PlayerProgressService.getCoins();
    const deltaCoins = snap.coins - curCoins;
    if (deltaCoins !== 0) {
        PlayerProgressService.addCoins(deltaCoins);
    }
    const hCur = PlayerProgressService.getPropInventoryHint();
    const hAdj = snap.hintInv - hCur;
    if (hAdj !== 0) {
        PlayerProgressService.addPropInventoryHint(hAdj);
    }
    const tCur = PlayerProgressService.getPropInventoryTime();
    const tAdj = snap.timeInv - tCur;
    if (tAdj !== 0) {
        PlayerProgressService.addPropInventoryTime(tAdj);
    }
    const sCur = PlayerProgressService.getPropInventorySmallTime();
    const sAdj = snap.smallTimeInv - sCur;
    if (sAdj !== 0) {
        PlayerProgressService.addPropInventorySmallTime(sAdj);
    }
    const rCur = PlayerProgressService.getPropInventoryReveal();
    const rAdj = snap.revealInv - rCur;
    if (rAdj !== 0) {
        PlayerProgressService.addPropInventoryReveal(rAdj);
    }
    const shCur = PlayerProgressService.getPropInventoryShuffleStock();
    const shAdj = snap.shuffleStockInv - shCur;
    if (shAdj !== 0) {
        PlayerProgressService.addPropInventoryShuffleStock(shAdj);
    }
    after.refreshCoinHud();
    after.refreshBagTexts();
}
