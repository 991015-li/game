import { Label } from 'cc';

/**
 * 轻量调整 {@link Label} 行高与字距，减轻中文在窄盒内挤作一团（不改字体资源）。
 */

/**
 * 放宽行高并设置略增字距；建议在挂载后、首帧排版前调用。
 *
 * @param lb 目标 Label
 * @param spacingX 额外字距（走引擎兼容字段）
 * @returns void
 */
export function relaxLabelDensity(lb: Label, spacingX = 1): void {
    const fs = lb.fontSize;
    lb.lineHeight = Math.max(lb.lineHeight, Math.ceil(fs * 1.22));
    (lb as unknown as { spacingX: number }).spacingX = spacingX;
}
