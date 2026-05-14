import { Color } from 'cc';

/**
 * 连击档位对应的**文案与缩放/星光提示**（纯规则，不创建节点）。
 */

const kMatchComboStreak2Color = new Color(255, 198, 128, 255);
const kMatchComboStreak3Color = new Color(255, 168, 112, 255);
const kMatchComboStreak4Color = new Color(255, 230, 150, 255);

export interface ComboJuiceHints {
    floater?: { text: string; color: Color };
    handPopPeak?: number;
    sparkles?: boolean;
}

/**
 * @param streak 连续吃牌次数（已含本手）
 * @returns 不足 2 连时为 `null`
 */
export function hintsForMatchStreak(streak: number): ComboJuiceHints | null {
    if (streak < 2) {
        return null;
    }
    if (streak === 2) {
        return { floater: { text: '连击 ×2', color: kMatchComboStreak2Color }, handPopPeak: 1.1 };
    }
    if (streak === 3) {
        return { floater: { text: '三连击！', color: kMatchComboStreak3Color }, handPopPeak: 1.14, sparkles: true };
    }
    if (streak === 4) {
        return { floater: { text: '手感火热', color: kMatchComboStreak4Color }, handPopPeak: 1.12, sparkles: true };
    }
    return { floater: { text: '根本停不下来', color: kMatchComboStreak4Color }, handPopPeak: 1.16, sparkles: true };
}
