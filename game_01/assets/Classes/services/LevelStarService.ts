/**
 * 关卡限时与评星：越靠后的关卡 {@link levelTimeLimitSec} 越短；评星阈值按本关限时等比例折算（与原 30s/60s 相对 180s 一致）。
 */

/** 第 1 关（或仅 1 关时）限时秒数 */
export const kLevelTimeLimitFirstSec = 180;

/** 最后一关限时秒数（随总关卡数线性插值） */
export const kLevelTimeLimitLastSec = 70;

/**
 * 按关卡在索引中的顺序（1-based）与总关数，计算本局限时（秒，整数）。
 *
 * @param levelOrder1Based 当前关在列表中的顺位（从 1 起）
 * @param totalLevels 总关卡数
 * @returns 整数秒
 */
export function levelTimeLimitSec(levelOrder1Based: number, totalLevels: number): number {
    const order = Math.max(1, Math.floor(levelOrder1Based));
    const n = Math.max(1, Math.floor(totalLevels));
    if (n <= 1) {
        return kLevelTimeLimitFirstSec;
    }
    const t = (order - 1) / (n - 1);
    return Math.round(kLevelTimeLimitFirstSec - (kLevelTimeLimitFirstSec - kLevelTimeLimitLastSec) * t);
}

/**
 * 根据通关用时与本关限时评星：≤限时×(30/180) 为三星，≤限时×(60/180) 为二星，否则一星。
 *
 * @param seconds 真实用时（秒）
 * @param levelTimeLimitSecValue 本关基础限时（不含道具加时）
 * @returns 1～3
 */
export function starsFromElapsedSeconds(seconds: number, levelTimeLimitSecValue: number): number {
    const lim = Math.max(1, levelTimeLimitSecValue);
    const fast = lim * (30 / 180);
    const mid = lim * (60 / 180);
    if (seconds <= fast) {
        return 3;
    }
    if (seconds <= mid) {
        return 2;
    }
    return 1;
}

/**
 * 将用时格式化为 `M:SS` 展示字符串（秒向下取整）。
 *
 * @param seconds 任意实数秒数（负数按 `0` 处理）
 * @returns 如 `0:05`、`12:34`
 */
export function formatElapsedMmSs(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
}
