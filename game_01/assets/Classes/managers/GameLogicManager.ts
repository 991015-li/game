import { GameModel } from '../models/GameModel';
import { MatchRuleService } from '../services/MatchRuleService';

/**
 * 撤销飞牌动画类型推断结果（由 {@link GameLogicManager.inferUndoAnimation} 返回）。
 */
export type UndoAnimKind = { type: 'draw' } | { type: 'play'; col: number };

/**
 * 单局玩法管理器：在 {@link GameModel} 之上实现可玩性判断、吃牌/抽牌步、撤销栈维护；
 * 构造时保存进入关卡时的模型快照，供 {@link resetToInitial} 整局恢复。
 *
 * **职责**：规则与步进；不创建节点、不读存档。
 *
 * **使用场景**：由 {@link GamePlayController} 在 `loadLevel` 成功后构造；`GameView` 通过
 * 控制器的 `logic` 查询可玩性并在动画结束后调用 `tryPlayColumn` / `tryDrawStock` 等。
 *
 * 由对局控制器持有实例（非单例）；不得引用任何视图或场景控制器，仅通过返回值/回调与上层协作。
 */
export class GameLogicManager {
    /** 本局共享的可变牌桌模型引用（与构造入参同一实例） */
    private readonly _model: GameModel;
    /** 进入本关时的模型深拷贝，供 {@link resetToInitial} 整局恢复 */
    private readonly _initialSnapshot: GameModel;
    /** 成功步进前的模型快照栈，用于单步撤销 */
    private _past: GameModel[] = [];

    /**
     * @param model 本局共享的数据模型（外部保证单局内引用不变）
     */
    constructor(model: GameModel) {
        this._model = model;
        this._initialSnapshot = model.clone();
    }

    /**
     * 当前关联的牌桌模型（只读引用，内容会随步变化）。
     *
     * @returns 与构造传入的同一实例
     */
    getModel(): GameModel {
        return this._model;
    }

    private _pushSnapshot(): void {
        this._past.push(this._model.clone());
    }

    /**
     * 列顶是否与当前手牌顶按规则可配对（列顶须已翻开）。
     * 规则：仅相邻点数、无花色要求（见 {@link MatchRuleService.canMatchBoardToHand}）。
     * @param colIndex 列下标
     */
    canPlayColumn(colIndex: number): boolean {
        const top = this._model.topOfColumn(colIndex);
        if (!top) {
            return false;
        }
        return MatchRuleService.canMatchBoardToHand(top.rank, this._model.getHandTopRank());
    }

    /**
     * 主牌堆是否存在任一列顶与底牌可匹配。
     */
    hasAnyBoardMatch(): boolean {
        const n = this._model.getColumns().length;
        for (let i = 0; i < n; i++) {
            if (this.canPlayColumn(i)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 当前是否允许从备用牌堆抽一张翻入底牌堆（仅要求备用堆尚有牌；与主牌堆是否存在可接列顶无关）。
     */
    canDrawStockNow(): boolean {
        return this._model.canDrawStock();
    }

    /**
     * 执行「收入列顶」一步；不合法则返回 false 且不记录撤销点。
     * @param colIndex 列下标
     * @returns 是否成功应用
     */
    tryPlayColumn(colIndex: number): boolean {
        if (!this.canPlayColumn(colIndex)) {
            return false;
        }
        this._pushSnapshot();
        this._model.applyPlayColumn(colIndex);
        return true;
    }

    /**
     * 执行「翻备用牌顶入底牌堆」一步；不合法则 false。
     * @returns 是否成功应用
     */
    tryDrawStock(): boolean {
        if (!this.canDrawStockNow()) {
            return false;
        }
        this._pushSnapshot();
        this._model.applyDrawStock();
        return true;
    }

    /**
     * 对比当前局面与撤销栈顶快照，推断上一手是抽牌还是吃列顶（供视图做回退飞牌终点）。
     * @param current 当前模型
     * @param snapshotPrev 即将恢复到的快照（栈顶）
     * @returns `draw` / `play` 或无法推断时 `null`
     */
    static inferUndoAnimation(current: GameModel, snapshotPrev: GameModel): UndoAnimKind | null {
        const colsC = current.getColumns();
        const colsP = snapshotPrev.getColumns();
        for (let c = 0; c < colsC.length; c++) {
            if (colsP[c].length === colsC[c].length + 1) {
                return { type: 'play', col: c };
            }
        }
        const sc = current.getStock().length;
        const sp = snapshotPrev.getStock().length;
        /** 旧规则：抽牌会消耗备用堆，撤销前多一张 */
        if (sp === sc + 1) {
            return { type: 'draw' };
        }
        /** 循环抽牌：张数不变，仅手牌与备用堆顺序变化；列未动则上一手为抽牌 */
        if (sp === sc) {
            const h0 = snapshotPrev.getHandTop();
            const h1 = current.getHandTop();
            if (h0.rank !== h1.rank || h0.suit !== h1.suit) {
                for (let c = 0; c < colsC.length; c++) {
                    if (colsP[c].length !== colsC[c].length) {
                        return null;
                    }
                }
                return { type: 'draw' };
            }
        }
        return null;
    }

    /**
     * 清空撤销栈并将牌桌恢复为进入关卡时的初始快照（与单步「回退」无关）。
     */
    resetToInitial(): void {
        this._past.length = 0;
        this._model.assignFrom(this._initialSnapshot);
    }

    /**
     * 查看撤销栈顶快照（不弹出）；无历史时为 `null`。
     */
    peekUndoSnapshot(): GameModel | null {
        if (!this._past.length) {
            return null;
        }
        return this._past[this._past.length - 1];
    }

    /**
     * 是否存在列顶为**未翻开**的暗牌（可使用「亮顶」道具）。
     */
    hasRevealableFaceDownTop(): boolean {
        const cols = this._model.getColumns();
        for (let c = 0; c < cols.length; c++) {
            const st = cols[c];
            if (st.length && !st[st.length - 1]!.faceUp) {
                return true;
            }
        }
        return false;
    }

    /**
     * 翻开**最靠左**一列当前列顶的暗牌（若存在）；记入撤销栈。
     *
     * @returns 是否成功翻开
     */
    tryRevealFirstFaceDownTop(): boolean {
        const cols = this._model.getColumns();
        for (let c = 0; c < cols.length; c++) {
            const st = cols[c];
            if (st.length && !st[st.length - 1]!.faceUp) {
                this._pushSnapshot();
                st[st.length - 1]!.faceUp = true;
                return true;
            }
        }
        return false;
    }

    /**
     * 备用盖牌是否至少 2 张（「洗背」才有意义）。
     */
    canShuffleStockForProp(): boolean {
        return this._model.getStock().length >= 2;
    }

    /**
     * 随机重排备用盖牌堆；记入撤销栈。
     *
     * @returns 是否执行成功
     */
    tryShuffleStock(): boolean {
        if (!this.canShuffleStockForProp()) {
            return false;
        }
        this._pushSnapshot();
        this._model.shuffleStockInPlace();
        return true;
    }

    /**
     * 弹出上一快照并写回模型（撤销一步）。
     * @returns 是否成功撤销
     */
    popUndoAndRestore(): boolean {
        if (!this._past.length) {
            return false;
        }
        const prev = this._past.pop()!;
        this._model.assignFrom(prev);
        return true;
    }

    /**
     * 同 {@link popUndoAndRestore}（兼容旧命名）。
     */
    undo(): boolean {
        return this.popUndoAndRestore();
    }
}
