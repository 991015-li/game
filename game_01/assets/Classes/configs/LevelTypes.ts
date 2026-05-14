/**
 * 关卡布局与索引条目相关的 DTO（与 JSON 字段对应，供加载器与管理器使用）。
 *
 * **职责**：定义磁盘/解析后的数据结构，不包含玩法规则或视图逻辑。
 */
import type { Card } from '../utils/CardEnums';

export interface LevelLayoutData {
    id: number;
    /**
     * 与关卡 JSON `meta.wildLimit` 同步写入并参与存档；**当前玩法匹配规则固定为列顶与手牌顶 rank 相差恰好 1**，
     * 对局内不再读取本字段（保留字段以免破坏旧存档与资源格式）。
     */
    matchRankMaxDiff: number;
    handTop: Card;
    stock: Card[];
    columns: Card[][];
}

/**
 * {@link parseLevelLayoutFromJson} 的可选参数：由选关/控制器注入关卡号，保证与入口 id 一致。
 */
export type ParseLevelLayoutOptions = {
    /**
     * 优先于 JSON 根字段 `id`；用于翻面数量、发牌张数与 {@link GameModel} 关卡 id。
     */
    levelId?: number;
};

export interface LevelIndexEntry {
    id: number;
    name: string;
    file: string;
    /** 选关圆钮上展示的图标，HTTPS 静态图（PNG/WebP/JPEG），由 {@link applyRemoteUrlToSprite} 加载 */
    selectIconUrl?: string;
    chapter: number;
    order: number;
    unlockType: string;
    prevId: number;
    /**
     * 未完成进度解锁时，是否可用金币提前解锁本关；
     * - `undefined`：使用关卡服务中的默认解锁价格公式；
     * - `0`：不允许金币解锁（只能靠通关进度）。
     */
    unlockCoinCost?: number;
}

export interface LevelIndexData {
    version: number;
    levels: LevelIndexEntry[];
}
