/**
 * 牌面数据结构、花色解析及展示用标签（与具体玩法规则解耦）。
 */
export interface Card {
    /** 点数 1–13（A=1） */
    rank: number;
    /** 内部花色 0–3（俱乐部/方块/红心/黑桃） */
    suit: number;
    /** 是否面朝上（翻开） */
    faceUp: boolean;
}

/** 用于校验整副牌唯一性（rank 1–13 × 花色 0–3） */
export function cardKey(c: Card): string {
    return `${c.rank}:${c.suit}`;
}

/** Fisher-Yates：就地打乱数组（用于随机发牌）；**修改**原数组。
 *
 * @param arr 待打乱数组
 */
export function shuffleArrayInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i]!;
        arr[i] = arr[j]!;
        arr[j] = t;
    }
}

/** 标准 52 张牌，全部背面朝上（牌库顺序：♣…♠，每花色 A→K） */
export function createStandardDeckFaceDown(): Card[] {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
        for (let rank = 1; rank <= 13; rank++) {
            deck.push({ rank, suit, faceUp: false });
        }
    }
    return deck;
}

/**
 * 解析关卡 JSON 中的单字母花色（C/D/H/S）为内部枚举值。
 * @param s 非空字符串，取首字符
 * @returns 0–3 或无法识别时 `null`
 */
export function parseSuitLetter(s: string): number | null {
    if (!s || !s.length) {
        return null;
    }
    switch (s[0]) {
        case 'C':
            return 0;
        case 'D':
            return 1;
        case 'H':
            return 2;
        case 'S':
            return 3;
        default:
            return null;
    }
}

/**
 * 将 rank 转为资源路径中使用的字母标签（A/J/Q/K 或数字字符串）。
 * @param rank 1–13
 */
export function rankLabel(rank: number): string {
    switch (rank) {
        case 1:
            return 'A';
        case 11:
            return 'J';
        case 12:
            return 'Q';
        case 13:
            return 'K';
        default:
            return String(rank);
    }
}

/** @param suit 内部花色 0–3 */
export function suitChar(suit: number): string {
    switch (suit) {
        case 0:
            return '♣';
        case 1:
            return '♦';
        case 2:
            return '♥';
        case 3:
            return '♠';
        default:
            return '?';
    }
}

/** 是否红色花色（方块/红心） */
export function isRedSuit(suit: number): boolean {
    return suit === 1 || suit === 2;
}

/**
 * 与策划/关卡 JSON 中数字花色一致，且与运行时 {@link Card.suit}（0–3）一致。
 * - CLUBS=0, DIAMONDS=1, HEARTS=2, SPADES=3
 */
export enum CardSuitType {
    NONE = -1,
    CLUBS = 0,
    DIAMONDS = 1,
    HEARTS = 2,
    SPADES = 3,
}

/**
 * 与策划 JSON 中 `CardFace` 一致，且与 {@link Card.rank}（A=1 … K=13）一致。
 */
export enum CardFaceType {
    NONE = -1,
    ACE = 1,
    TWO = 2,
    THREE = 3,
    FOUR = 4,
    FIVE = 5,
    SIX = 6,
    SEVEN = 7,
    EIGHT = 8,
    NINE = 9,
    TEN = 10,
    JACK = 11,
    QUEEN = 12,
    KING = 13,
}
