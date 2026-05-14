/**
 * 对局道具：图标使用 HTTPS 远程 PNG（可被 {@link applyRemoteUrlToSprite} 加载）。
 * 若 CDN 失效，可换成任意可直连的图片地址。
 */
export const kPropHintIconUrl =
    'https://img.icons8.com/fluency/96/lightning-bolt.png';

export const kPropAddTimeIconUrl =
    'https://img.icons8.com/fluency/96/clock.png';

/** 小幅加时（秒数较少，价格更低） */
export const kPropSmallTimeIconUrl =
    'https://img.icons8.com/fluency/96/speed.png';

/** 翻开最左列顶暗牌 */
export const kPropRevealTopIconUrl =
    'https://img.icons8.com/fluency/96/visible.png';

/** 随机重排备用盖牌堆 */
export const kPropShuffleStockIconUrl =
    'https://img.icons8.com/fluency/96/shuffle.png';

/** 每局免费「提示」次数用尽后，每次消耗金币 */
export const kPropHintCoinAfterFree = 25;

/** 每局免费「加时」次数用尽后，每次消耗金币 */
export const kPropTimeCoinAfterFree = 40;

/** 本局免费提示次数 */
export const kPropFreeHintPerLevel = 4;

/** 本局免费加时次数 */
export const kPropFreeTimePerLevel = 2;

/** 每次加时增加秒数（仅放宽超时，评星仍按原限时计算） */
export const kPropAddTimeSeconds = 22;

/** 「短补」小幅加时（秒） */
export const kPropAddSmallTimeSeconds = 10;

/** 本局免费「短补」次数 */
export const kPropFreeSmallTimePerLevel = 2;

/** 「短补」用尽后当场扣金 */
export const kPropSmallTimeCoinAfterFree = 16;

/** 本局免费「亮顶」次数 */
export const kPropFreeRevealPerLevel = 2;

/** 「亮顶」用尽后当场扣金 */
export const kPropRevealCoinAfterFree = 20;

/** 本局免费「洗背」次数 */
export const kPropFreeShuffleStockPerLevel = 1;

/** 「洗背」用尽后当场扣金（备用堆至少 2 张时可用） */
export const kPropShuffleStockCoinAfterFree = 28;

/** 选关商店：购买 1 次「额外提示」持久库存（进入对局后优先于当场扣金消耗） */
export const kPropBuyInventoryHintPrice = 22;

/** 选关商店：购买 1 次「额外加时」持久库存 */
export const kPropBuyInventoryTimePrice = 36;

/** 选关商店：短补库存 +1 */
export const kPropBuyInventorySmallTimePrice = 14;

/** 选关商店：亮顶库存 +1 */
export const kPropBuyInventoryRevealPrice = 18;

/** 选关商店：洗背库存 +1 */
export const kPropBuyInventoryShuffleStockPrice = 26;
