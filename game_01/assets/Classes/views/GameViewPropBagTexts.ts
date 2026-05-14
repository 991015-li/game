import {
    kPropHintCoinAfterFree,
    kPropRevealCoinAfterFree,
    kPropShuffleStockCoinAfterFree,
    kPropSmallTimeCoinAfterFree,
    kPropTimeCoinAfterFree,
} from '../configs/GameplayPropsConfig';
import { PlayerProgressService } from '../services/PlayerProgressService';
import type { PropBagRowTexts } from './PropBagPanel';

function propLineSummary(freeRem: number, inv: number, coin: number): string {
    const n = freeRem + inv;
    return n > 0 ? `还可 ${n} 次（免费+库存）` : `当场 ${coin} 金/次`;
}

/** 根据当前免费次数与库存生成道具包五行说明文案。 */
export function buildPropBagRowTextsFromProgress(
    hintFreeRem: number,
    timeFreeRem: number,
    smallTimeFreeRem: number,
    revealFreeRem: number,
    shuffleStockFreeRem: number,
): PropBagRowTexts {
    return {
        hint: propLineSummary(hintFreeRem, PlayerProgressService.getPropInventoryHint(), kPropHintCoinAfterFree),
        time: propLineSummary(timeFreeRem, PlayerProgressService.getPropInventoryTime(), kPropTimeCoinAfterFree),
        smallTime: propLineSummary(smallTimeFreeRem, PlayerProgressService.getPropInventorySmallTime(), kPropSmallTimeCoinAfterFree),
        revealTop: propLineSummary(revealFreeRem, PlayerProgressService.getPropInventoryReveal(), kPropRevealCoinAfterFree),
        shuffleStock: propLineSummary(
            shuffleStockFreeRem,
            PlayerProgressService.getPropInventoryShuffleStock(),
            kPropShuffleStockCoinAfterFree,
        ),
    };
}
