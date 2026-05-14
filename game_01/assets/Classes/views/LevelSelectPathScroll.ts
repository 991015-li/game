import { Layers, Node } from 'cc';
import type { Mask, ScrollView, UITransform } from 'cc';
import { ccAdd, ccGet, kEngineMaskTypeGraphicsRect } from '../utils/CcEngineComponent';

export type PathScrollRefs = {
    listHolder: Node;
    pathContent: Node;
    scrollComp: ScrollView;
};

/**
 * 创建或更新选关曲线路径用的竖向 {@link ScrollView}：`content` 供关卡圆点挂载。
 *
 * @param root 全屏 shell
 * @param existing 若已创建过则仅调整尺寸并返回同一组节点
 * @param rootW shell 宽度
 * @param rootH shell 高度
 * @param headerBand 顶栏占用高度（标题+金币条），用于计算列表可视高度
 * @param contentH 滚动内容总高度
 * @returns 外层 `levelPathScroll` 与其中 `content` 节点
 */
function resizeLevelPathScroll(refs: PathScrollRefs, rootW: number, rootH: number, headerBand: number, contentH: number): void {
    const { listHolder } = refs;
    const outerUi = ccGet<UITransform>(listHolder, 'UITransform');
    if (!outerUi) {
        return;
    }
    outerUi.setContentSize(rootW, Math.max(200, rootH - headerBand - Math.round(rootH * 0.14)));
    const scroll = listHolder.getChildByName('scrollView');
    const view = scroll?.getChildByName('view');
    const viewUi = view ? ccGet<UITransform>(view, 'UITransform') : null;
    const scrollUi = scroll ? ccGet<UITransform>(scroll, 'UITransform') : null;
    if (viewUi && scrollUi) {
        viewUi.setContentSize(outerUi.width, outerUi.height);
        scrollUi.setContentSize(outerUi.width, outerUi.height);
    }
    const content = view?.getChildByName('content');
    const cUi = content ? ccGet<UITransform>(content, 'UITransform') : null;
    if (cUi) {
        cUi.setContentSize(rootW, contentH);
    }
}

function createLevelPathScroll(root: Node, rootW: number, rootH: number, headerBand: number, contentH: number): PathScrollRefs {
    const halfH = rootH * 0.5;
    const listTopWidgetY = halfH - headerBand;
    const scrollH = Math.max(200, rootH - headerBand - Math.round(rootH * 0.14));

    const outer = new Node('levelPathScroll');
    outer.layer = Layers.Enum.UI_2D;
    ccAdd<UITransform>(outer, 'UITransform').setContentSize(rootW, scrollH);
    outer.setPosition(0, listTopWidgetY - scrollH * 0.5, 0);

    const scrollNode = new Node('scrollView');
    scrollNode.layer = Layers.Enum.UI_2D;
    ccAdd<UITransform>(scrollNode, 'UITransform').setContentSize(rootW, scrollH);
    const sc = ccAdd<ScrollView>(scrollNode, 'ScrollView');
    sc.horizontal = false;
    sc.vertical = true;
    sc.inertia = true;
    sc.elastic = true;

    const view = new Node('view');
    view.layer = Layers.Enum.UI_2D;
    const viewUi = ccAdd<UITransform>(view, 'UITransform');
    viewUi.setContentSize(rootW, scrollH);
    const mask = ccAdd<Mask>(view, 'Mask');
    mask.type = kEngineMaskTypeGraphicsRect;

    const content = new Node('content');
    content.layer = Layers.Enum.UI_2D;
    const cUi = ccAdd<UITransform>(content, 'UITransform');
    cUi.setContentSize(rootW, contentH);
    cUi.anchorY = 1;

    view.addChild(content);
    scrollNode.addChild(view);
    sc.content = content;
    outer.addChild(scrollNode);

    root.addChild(outer);
    return { listHolder: outer, pathContent: content, scrollComp: sc };
}

/**
 * 创建或更新选关曲线路径用的竖向 {@link ScrollView}：`content` 供关卡圆点挂载。
 *
 * @param root 全屏 shell
 * @param existing 若已创建过则仅调整尺寸并返回同一组节点
 * @param rootW shell 宽度
 * @param rootH shell 高度
 * @param headerBand 顶栏占用高度（标题+金币条），用于计算列表可视高度
 * @param contentH 滚动内容总高度
 * @returns 外层 `levelPathScroll` 与其中 `content` 节点
 */
export function ensureLevelPathScroll(
    root: Node,
    existing: PathScrollRefs | null,
    rootW: number,
    rootH: number,
    headerBand: number,
    contentH: number,
): PathScrollRefs {
    if (existing) {
        resizeLevelPathScroll(existing, rootW, rootH, headerBand, contentH);
        return existing;
    }
    return createLevelPathScroll(root, rootW, rootH, headerBand, contentH);
}
