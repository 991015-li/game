/**
 * 关卡布局 JSON 解析的**共用工具**（类型收窄、`id`、`meta.wildLimit`）。
 *
 * **职责**：为 {@link LevelLayoutLoader} 与 {@link LevelLayoutAuthoringV1} 提供无业务分支的纯函数，避免重复与循环依赖。
 *
 * **使用场景**：解析任意关卡根对象的前置字段时复用；不负责列结构或发牌逻辑。
 */

/**
 * 将未知 JSON 值收窄为「属性字典」，非对象时返回 `null`。
 *
 * @param value 任意解析后的 JSON 节点
 * @returns 可索引的对象，或 `null`
 */
export function asObject(value: unknown): Record<string, unknown> | null {
    return value != null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/**
 * 读取关卡号：支持 `number` 或可解析的 `string`。
 *
 * @param raw JSON 根上的 `id` 等字段
 * @returns 非负整数；无法解析时为 `0`
 */
export function coerceLevelId(raw: unknown): number {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.trunc(raw);
    }
    if (typeof raw === 'string') {
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
}

/**
 * 从 `meta.wildLimit` 读取「相邻 rank」容错上限（ clamp 到 1…12 ）。
 *
 * @param root 关卡 JSON 根对象
 * @returns 默认 `1`（缺省或非法时）
 */
export function parseWildLimitFromMeta(root: Record<string, unknown>): number {
    const meta = asObject(root.meta);
    if (!meta || typeof meta.wildLimit !== 'number' || !Number.isFinite(meta.wildLimit)) {
        return 1;
    }
    return Math.max(1, Math.min(12, Math.floor(meta.wildLimit)));
}
