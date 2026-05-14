import { Component, Node as CocosNode } from 'cc';

/**
 * Cocos 内置组件安全访问：用注册名 `cc.X` / `X` 做 `getComponent` / `addComponent`，规避 ES 模块循环导致类引用为 `undefined`。
 *
 * **职责**：仅包装引擎节点 API；不承担游戏业务。
 *
 * **使用场景**：选关、对局 shell、Bootstrap 等在首包加载顺序不稳处取 `Camera`、`UITransform`、`ScrollView` 等。
 */
export function ccGet<T extends Component>(node: CocosNode, simpleClassName: string): T | null {
    const q = `cc.${simpleClassName}`;
    for (const name of [q, simpleClassName]) {
        const c = node.getComponent(name) as T | null;
        if (c != null) {
            return c;
        }
    }
    return null;
}

/** 同上，使用字符串形式的 `addComponent`。 */
export function ccAdd<T extends Component>(node: CocosNode, simpleClassName: string): T {
    const q = `cc.${simpleClassName}`;
    let last: unknown;
    for (const name of [q, simpleClassName]) {
        try {
            return node.addComponent(name) as T;
        } catch (e) {
            last = e;
        }
    }
    throw last instanceof Error ? last : new Error(`ccAdd('${simpleClassName}') failed`);
}

/** 与引擎 `MaskType` 一致（勿读 `Mask.Type`，`Mask` 未导入时即崩溃） */
export const kEngineMaskTypeGraphicsRect = 0;
export const kEngineMaskTypeGraphicsEllipse = 1;

/** 与引擎 `Layout.Type` / `ResizeMode` / `HorizontalDirection` 一致（3.8.x） */
export const kEngineLayoutTypeHorizontal = 1;
export const kEngineLayoutResizeModeNone = 0;
export const kEngineLayoutHorizontalDirLtr = 0;
