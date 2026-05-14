import type { Card } from '../utils/CardEnums';
import type { LevelLayoutData } from '../configs/LevelTypes';

/**
 * 可 JSON 序列化的对局状态快照，用于存档与读档恢复。
 * 仅含牌桌数据，不含撤销栈（撤销栈由对局管理器单独策略决定是否持久化）。
 */
export interface GameModelPlain {
    /** 关卡 id，与布局一致 */
    levelId: number;
    /** 与 {@link LevelLayoutData.matchRankMaxDiff} 一致；缺省按 `1` */
    matchRankMaxDiff?: number;
    /** 当前底牌堆顶 */
    handTop: Card;
    /** 备用盖牌数组（末尾为「堆顶」） */
    stock: Card[];
    /** 主牌列，每列最后一项为列顶 */
    columns: Card[][];
}

/**
 * 单局牌桌数据模型：底牌堆顶、备用牌堆、主牌堆各列。
 * 负责状态存储与基础应用操作，不包含「能否打牌」等规则判断（由管理器/服务完成）。
 *
 * **使用场景**：由 {@link GamePlayController} 在解析布局 JSON 后构造；局内仅持有单实例，
 * 撤销通过 `clone` / `assignFrom` 与栈协作。
 */
export class GameModel {
    /** 当前关卡 id（与布局/存档一致） */
    private _levelId = 0;
    /** 底牌堆当前朝上的顶牌（手牌可视区） */
    private _handTop: Card = { rank: 1, suit: 0, faceUp: true };
    /** 备用盖牌堆；从数组**末尾**抽为「牌堆顶」 */
    private _stock: Card[] = [];
    /** 主牌列；每列 `columns[col][length-1]` 为列顶 */
    private _columns: Card[][] = [];
    /**
     * 与 {@link LevelLayoutData.matchRankMaxDiff} 一并存档/克隆；当前接牌规则不使用本值。
     */
    private _matchRankMaxDiff = 1;

    /**
     * @param layout 可选；传入时立即 {@link resetFromLayout}
     */
    constructor(layout?: LevelLayoutData) {
        if (layout) {
            this.resetFromLayout(layout);
        }
    }

    /**
     * 用关卡静态配置覆盖整局牌桌数据。
     * @param layout 由关卡加载器解析的布局（含完整 `stock` / `columns`）
     * @returns void
     */
    resetFromLayout(layout: LevelLayoutData): void {
        this._levelId = layout.id;
        this._matchRankMaxDiff = layout.matchRankMaxDiff;
        this._handTop = { ...layout.handTop };
        this._stock = layout.stock.map((c) => ({ ...c }));
        this._columns = layout.columns.map((col) => col.map((c) => ({ ...c })));
    }

    /**
     * 导出为可 `JSON.stringify` 的纯对象（不含撤销栈）。
     * @returns {@link GameModelPlain}
     */
    toPlain(): GameModelPlain {
        return {
            levelId: this._levelId,
            matchRankMaxDiff: this._matchRankMaxDiff,
            handTop: { ...this._handTop },
            stock: this._stock.map((c) => ({ ...c })),
            columns: this._columns.map((col) => col.map((c) => ({ ...c }))),
        };
    }

    /**
     * 从存档快照构造新实例。
     * @param plain {@link GameModelPlain}
     * @returns 独立模型实例
     */
    static fromPlain(plain: GameModelPlain): GameModel {
        const m = new GameModel();
        m._levelId = plain.levelId;
        m._matchRankMaxDiff = plain.matchRankMaxDiff ?? 1;
        m._handTop = { ...plain.handTop };
        m._stock = plain.stock.map((c) => ({ ...c }));
        m._columns = plain.columns.map((col) => col.map((c) => ({ ...c })));
        return m;
    }

    /**
     * 主牌各列是否均已无牌（胜利条件之一）。
     * @returns 全部列为空时为 `true`
     */
    isBoardEmpty(): boolean {
        return this._columns.every((col) => col.length === 0);
    }

    /**
     * 底牌堆顶的 rank，用于与列顶按规则匹配。
     * @returns `1`～`13`
     */
    getHandTopRank(): number {
        return this._handTop.rank;
    }

    /**
     * 底牌堆顶牌只读视图（与内部状态同步）。
     * @returns 当前 {@link Card}
     */
    getHandTop(): Card {
        return this._handTop;
    }

    /**
     * 当前关卡 id。
     * @returns 与 {@link resetFromLayout} / 构造时布局一致
     */
    getLevelId(): number {
        return this._levelId;
    }

    /**
     * 本关允许的列顶与手牌最大 rank 差（规则上限，实际步内还会随关卡顺位再封顶）。
     */
    getMatchRankMaxDiff(): number {
        return this._matchRankMaxDiff;
    }

    /**
     * 主牌列二维数组（与内部为同一引用，请勿在局外直接突变）。
     * @returns 自下标 `0` 为列底，末尾为列顶
     */
    getColumns(): Card[][] {
        return this._columns;
    }

    /**
     * 备用牌堆数组（与内部为同一引用；从末尾抽）。
     * @returns `.length === 0` 时不可再抽
     */
    getStock(): Card[] {
        return this._stock;
    }

    /**
     * 指定列顶是否存在且已翻开（可尝试参与规则判断）。
     * @param col 列索引
     * @returns 列越界、无牌或顶牌未翻开时为 `false`
     */
    isColumnTopPlayable(col: number): boolean {
        if (col < 0 || col >= this._columns.length) {
            return false;
        }
        const stack = this._columns[col];
        if (!stack.length) {
            return false;
        }
        return stack[stack.length - 1].faceUp;
    }

    /**
     * 读取已翻开列顶的牌数据。
     * @param col 列索引
     * @returns 不可见顶时 `null`，否则为列顶 {@link Card}
     */
    topOfColumn(col: number): Card | null {
        if (!this.isColumnTopPlayable(col)) {
            return null;
        }
        return this._columns[col][this._columns[col].length - 1];
    }

    /**
     * 备用堆是否尚有牌。
     * @returns `stock.length > 0`
     */
    canDrawStock(): boolean {
        return this._stock.length > 0;
    }

    /**
     * 从备用末尾抽一张翻为新手牌顶，原手牌顶插入备用**前端**（循环翻牌规则）。
     * @returns void
     */
    applyDrawStock(): void {
        if (!this._stock.length) {
            return;
        }
        const prevHand = { ...this._handTop };
        const drawn = this._stock[this._stock.length - 1]!;
        this._stock.pop();
        this._handTop = { ...drawn };
        this._handTop.faceUp = true;
        this._stock.unshift(prevHand);
    }

    /**
     * 将指定列顶牌移入手牌顶并翻开下列顶（**不**校验规则，由上层保证合法）。
     * @param col 列索引
     * @returns void
     */
    applyPlayColumn(col: number): void {
        if (col < 0 || col >= this._columns.length) {
            return;
        }
        const stack = this._columns[col];
        if (!stack.length || !stack[stack.length - 1].faceUp) {
            return;
        }
        const moved = stack.pop()!;
        this._handTop = { ...moved };
        this._handTop.faceUp = true;
        if (stack.length) {
            stack[stack.length - 1].faceUp = true;
        }
    }

    /**
     * 深拷贝当前牌桌状态（用于撤销栈）。
     * @returns 独立 {@link GameModel}
     */
    clone(): GameModel {
        const m = new GameModel();
        m._levelId = this._levelId;
        m._matchRankMaxDiff = this._matchRankMaxDiff;
        m._handTop = { ...this._handTop };
        m._stock = this._stock.map((c) => ({ ...c }));
        m._columns = this._columns.map((col) => col.map((c) => ({ ...c })));
        return m;
    }

    /**
     * 用另一实例覆盖本实例数据（撤销恢复）。
     * @param other 来源模型
     * @returns void
     */
    assignFrom(other: GameModel): void {
        this._levelId = other._levelId;
        this._matchRankMaxDiff = other._matchRankMaxDiff;
        this._handTop = { ...other._handTop };
        this._stock = other._stock.map((c) => ({ ...c }));
        this._columns = other._columns.map((col) => col.map((c) => ({ ...c })));
    }

    /**
     * Fisher–Yates 就地打乱 `stock` 顺序（张数不变）。
     * @returns void
     */
    shuffleStockInPlace(): void {
        const a = this._stock;
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i]!;
            a[i] = a[j]!;
            a[j] = t;
        }
    }
}
