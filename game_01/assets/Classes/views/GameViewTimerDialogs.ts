import type { Node } from 'cc';
import { Color, Label } from 'cc';
import { kTimerCritical, kTimerRelaxed, kTimerTense } from '../configs/UiWarmPalette';
import type { GamePlayController } from '../controllers/GamePlayController';
import { formatElapsedMmSs } from '../services/LevelStarService';
import { spawnWinConfetti } from './MatchPresentationVfx';
import { attachGameFailDialog } from './GameFailDialogView';
import { attachGameWinDialog } from './GameWinDialogView';

/**
 * 对局限时 HUD 绘制、超时触发与胜/败弹层装配：连接 {@link GamePlayController} 与纯 UI 视图模块。
 */

function timerColorEqual(a: Color, b: Color): boolean {
    return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

/**
 * 刷新顶栏限时文案与颜色，并在绘制后回调（用于检测超时）。
 *
 * @param label 限时 Label（可 null）
 * @param timedOut 已超时则不再改文案
 * @param limitSec 展示用上限秒数（通常为 `effectiveTimeLimitSec`）
 * @param levelStartMs 本局逻辑开局时间戳
 * @param clockNowMs 当前用于显示的时钟（暂停时需冻结戳）
 * @param onAfterPaint 每次刷新后的已用时秒数
 */
export function paintLevelTimerLabel(
    label: Label | null,
    timedOut: boolean,
    limitSec: number,
    levelStartMs: number,
    clockNowMs: number,
    onAfterPaint: (elapsedSec: number) => void
): void {
    if (!label?.isValid) {
        return;
    }
    const lim = Number.isFinite(limitSec) && limitSec > 0 ? limitSec : 1;
    const elapsed = (clockNowMs - levelStartMs) / 1000;
    const disp = Math.min(elapsed, lim);
    if (timedOut) {
        return;
    }
    const nextStr = `用时 ${formatElapsedMmSs(disp)} / ${formatElapsedMmSs(lim)}`;
    let nextColor: Color;
    if (elapsed >= lim) {
        nextColor = kTimerCritical;
    } else if (elapsed > lim * 0.85) {
        nextColor = kTimerTense;
    } else {
        nextColor = kTimerRelaxed;
    }
    if (label.string !== nextStr) {
        label.string = nextStr;
    }
    if (!timerColorEqual(label.color, nextColor)) {
        label.color = nextColor;
    }
    onAfterPaint(elapsed);
}

/**
 * 当已用时达到上限且未在飞牌时标记超时并打开失败流程。
 *
 * @param elapsedSec 已用秒数
 * @param limitSec 上限秒数
 * @param flyAnimating 飞牌中不触发失败
 * @param markTimedOut 写入控制器超时态
 * @param openFail 弹出失败 UI
 */
export function maybeFireTimeUp(
    elapsedSec: number,
    limitSec: number,
    flyAnimating: boolean,
    markTimedOut: () => boolean,
    openFail: () => void
): void {
    if (elapsedSec < limitSec || flyAnimating || !markTimedOut()) {
        return;
    }
    openFail();
}

/**
 * 失败结算时将 HUD 限时改为超时文案（停表后调用）。
 *
 * @param label 限时 Label
 * @param limitSec 本关限时秒数（展示用）
 */
export function paintTimeoutHudMessage(label: Label | null, limitSec: number): void {
    if (!label?.isValid) {
        return;
    }
    label.string = `本关已超时（限时 ${formatElapsedMmSs(limitSec)}）`;
    label.color = kTimerCritical;
}

/**
 * 挂载失败对话框（含重玩与回大厅）。
 *
 * @param root 对局 shell
 * @param bounds shell 外接矩形
 * @param controller 本局控制器
 * @param onBackToMenu 返回选关/大厅
 */
export function openFailDialogUi(
    root: Node,
    bounds: { width: number; height: number; left: number; bottom: number },
    controller: GamePlayController,
    onBackToMenu: () => void
): void {
    const replay = controller.startLevelHandler;
    attachGameFailDialog(root, bounds, {
        timeLimitSec: controller.effectiveTimeLimitSec,
        onReplay: () => replay(controller.levelId, controller.layoutPath),
        onBackToMenu,
    });
}

/**
 * 挂载胜利对话框并在遮罩上播彩屑。
 *
 * @param root 对局 shell
 * @param bounds shell 外接矩形
 * @param controller 本局控制器（需已 `tryMarkWin`）
 * @param onBackToMenu 返回选关/大厅
 */
export function openWinDialogUi(
    root: Node,
    bounds: { width: number; height: number; left: number; bottom: number },
    controller: GamePlayController,
    onBackToMenu: () => void
): void {
    const next = controller.nextLevel;
    const replay = controller.startLevelHandler;
    attachGameWinDialog(root, bounds, {
        hasNextLevel: next != null,
        stars: controller.lastWinStars,
        timeText: formatElapsedMmSs(controller.lastWinElapsedSec),
        onReplay: () => replay(controller.levelId, controller.layoutPath),
        onBackToMenu,
        onNextLevel: () => {
            if (next) {
                replay(next.id, next.path);
            }
        },
    });
    const winOv = root.getChildByName('winOverlay');
    if (winOv) {
        spawnWinConfetti(winOv, bounds, true);
    }
}
