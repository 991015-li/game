import type { Node } from 'cc';
import type { GameLogicManager } from '../managers/GameLogicManager';
import { computeBoardLayoutMetrics, readRootBounds, zoneHeightRatio, type BoardLayoutMetrics } from './GameViewBoardLayout';

/**
 * 根据 shell 尺寸与玩法区设计稿比例，解析当前局的 {@link BoardLayoutMetrics} 与列内叠牌步长。
 */
export function resolveBoardLayoutStackStep(
    root: Node,
    logic: GameLogicManager,
    fallbackWidth: number,
    fallbackHeight: number,
    handZoneDesignH: number,
    boardZoneDesignH: number,
): { metrics: BoardLayoutMetrics; stackStep: number } {
    const bounds = readRootBounds(root, fallbackWidth, fallbackHeight);
    const handH = zoneHeightRatio(bounds.height, handZoneDesignH, fallbackHeight);
    const boardH = zoneHeightRatio(bounds.height, boardZoneDesignH, fallbackHeight);
    const cols = logic.getModel().getColumns();
    const levelId = logic.getModel().getLevelId();
    return computeBoardLayoutMetrics(bounds, handH, boardH, cols, levelId);
}
