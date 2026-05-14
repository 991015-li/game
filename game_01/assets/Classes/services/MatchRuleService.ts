/**
 * 列顶牌与手牌顶之间的数字匹配规则（无状态纯函数服务）。
 *
 * **职责**：仅当 **rank 相差恰好为 1**（相邻点数）时可配对；**花色不参与**。
 *
 * **使用场景**：{@link GameLogicManager.canPlayColumn} 与单元测试。
 */
export class MatchRuleService {
    /**
     * 列顶是否与手牌顶可配对：`|boardRank - handRank| === 1`；同点、差 2 及以上均为不可配。
     *
     * @param boardRank 列顶牌点数（1–13）
     * @param handRank 手牌区顶部点数（1–13）
     */
    static canMatchBoardToHand(boardRank: number, handRank: number): boolean {
        const diff = Math.abs(boardRank - handRank);
        return diff === 1;
    }
}
