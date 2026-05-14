import { Node, UITransform, Vec3 } from 'cc';

/** 将 `n` 的世界坐标转为 `ancestor`（须含 UITransform）下的局部坐标。 */
export function convertToRootLocal(ancestor: Node, n: Node): Vec3 {
    const uit = ancestor.getComponent(UITransform);
    const out = new Vec3();
    if (!uit) {
        return out;
    }
    const w = new Vec3();
    n.getWorldPosition(w);
    uit.convertToNodeSpaceAR(w, out);
    return out;
}
