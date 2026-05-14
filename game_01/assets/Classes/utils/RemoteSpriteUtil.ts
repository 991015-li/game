import { ImageAsset, Sprite, SpriteFrame, Texture2D, assetManager } from 'cc';

/**
 * 远程 HTTPS 静态图加载并赋给 {@link Sprite}（失败静默，不抛错）。
 */

/** 从 URL 猜解码器扩展名（`loadRemote` 用）。 */
function extForRemoteImageUrl(url: string): string {
    const path = (url.split('?')[0] ?? '').toLowerCase();
    if (path.endsWith('.webp')) {
        return '.webp';
    }
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        return '.jpg';
    }
    if (path.endsWith('.png')) {
        return '.png';
    }
    return '.png';
}

/**
 * 异步拉取网络图片并替换 `sprite.spriteFrame`；失败时保留原图。
 *
 * @param sprite 目标 UI 精灵
 * @param url 可直连的静态图 URL（后缀尽量明确，便于选择解码器）
 * @param onDone 可选；`true` 表示贴图已更新
 * @returns void
 */
export function applyRemoteUrlToSprite(sprite: Sprite, url: string, onDone?: (ok: boolean) => void): void {
    const ext = extForRemoteImageUrl(url);
    assetManager.loadRemote<ImageAsset>(url, { ext }, (err, asset) => {
        if (err || asset == null || !sprite.isValid) {
            onDone?.(false);
            return;
        }
        const tex = new Texture2D();
        tex.image = asset;
        const sf = new SpriteFrame();
        sf.texture = tex;
        sf.packable = false;
        sprite.spriteFrame = sf;
        onDone?.(true);
    });
}
