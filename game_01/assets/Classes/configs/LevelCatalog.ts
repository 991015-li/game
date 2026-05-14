import { JsonAsset, resources } from 'cc';
import { parseLevelIndexFromJson } from './LevelIndexLoader';
import type { LevelIndexData } from './LevelTypes';

/**
 * 关卡资源在 `resources` 下的路径与加载工具。
 * 路径不含 `.json` 扩展名。
 */

/** 关卡索引文件（相对于 resources） */
export const kLevelIndexResource = 'Data/level/level_index';

/** 成功后常驻；**绝不**把「加载失败」缓存成终态，否则会永久跳过开局解锁校验 */
let _sessionLevelIndex: LevelIndexData | null = null;
let _indexLoadInFlight: Promise<LevelIndexData | null> | null = null;

const kIndexLoadAttempts = 4;

/**
 * 解析后的关卡索引：成功后缓存；失败则允许下次重试（带退避）。
 * 供选关 UI 与 {@link GameBootstrap.startGame} 门禁共用，避免两边结果不一致或「null 永缓存」导致绕过校验。
 */
export function getLevelIndexDataCached(): Promise<LevelIndexData | null> {
    if (_sessionLevelIndex != null) {
        return Promise.resolve(_sessionLevelIndex);
    }
    if (_indexLoadInFlight != null) {
        return _indexLoadInFlight;
    }
    _indexLoadInFlight = (async (): Promise<LevelIndexData | null> => {
        for (let attempt = 0; attempt < kIndexLoadAttempts; attempt++) {
            if (attempt > 0) {
                await new Promise<void>((r) => setTimeout(r, 45 * attempt));
            }
            try {
                const doc = await loadJsonFromResources(kLevelIndexResource);
                const parsed = parseLevelIndexFromJson(doc);
                if (parsed.ok) {
                    _sessionLevelIndex = parsed.data;
                    return parsed.data;
                }
            } catch {
                /* 下一次 attempt */
            }
        }
        return null;
    })().finally(() => {
        _indexLoadInFlight = null;
    });
    return _indexLoadInFlight;
}

/**
 * 将关卡索引条目中的 `file` 字段规范为 resources 路径（无扩展名）。
 * @param fileField 如 `level/level_001.json` 或 `level/level_001`
 */
export function layoutResourcePathFromIndexFile(fileField: string): string {
    let s = fileField.trim().replace(/\\/g, '/');
    if (s.toLowerCase().endsWith('.json')) {
        s = s.slice(0, -5);
    }
    return s;
}

/**
 * 异步加载 JSON 资源并返回解析后的根对象。
 * @param pathNoExt resources 路径，无扩展名，如 `Data/level/level_001`
 */
export function loadJsonFromResources(pathNoExt: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
        resources.load(pathNoExt, JsonAsset, (e, asset) => {
            if (e || !asset) {
                reject(e ?? new Error(`missing ${pathNoExt}`));
                return;
            }
            resolve(asset.json);
        });
    });
}
