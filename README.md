# game

基于 **Cocos Creator 3.8.8** 与 **TypeScript** 的纸牌类小游戏工程（包名 `card_game`）。

## 仓库结构

| 路径 | 说明 |
|------|------|
| `game_01/` | Cocos Creator 工程根目录（脚本、场景、资源等） |
| `game_01/assets/` | 资源与源码（含 `scripts/`、`scenes/`、`resources/` 等） |
| `game_01/docs/` | 设计说明（如 `PROGRAM_DESIGN.md`） |

> 说明：`library/`、`temp/`、`node_modules/`、`.creator/` 等由编辑器或依赖生成，已通过根目录 `.gitignore` 排除；克隆后需在本地重新生成。

## 环境要求

- [Cocos Creator 3.8.8](https://www.cocos.com/creator-download)（与 `game_01/package.json` 中 `creator.version` 一致为佳）
- Node.js（用于安装 `game_01` 下 npm 依赖，如 TypeScript）

## 本地运行

1. **克隆仓库**

   ```bash
   git clone https://github.com/991015-li/game.git
   cd game
   ```

2. **安装脚本依赖（可选，按需在 `game_01` 目录执行）**

   ```bash
   cd game_01
   npm install
   ```

3. **用 Cocos Creator 打开工程**

   - 菜单：**文件 → 打开项目**，选择本仓库中的 **`game_01`** 目录（不是仓库根目录 `game/`）。
   - 等待资源导入与脚本编译完成，控制台无持续报错。

4. **启动场景**

   - 在 **项目 → 项目设置** 中确认启动场景为 **Main**。
   - 若未设置，可在资源管理器中右键 **`assets/scenes/Main.scene`**，设为启动场景。

5. **预览**

   - 点击编辑器顶部 **预览**（如浏览器预览）运行游戏。

### 常见问题

- 若出现 **Missing class** 或与脚本 UUID 不一致：完全退出 Creator，删除 `game_01` 下的 **`library`** 与 **`temp`**，再重新打开工程并等待导入结束。
- 启动逻辑入口：`Main.scene` 挂载 **`GameBootstrap`**（对应 `assets/scripts/GameBootstrap.ts`）。

## 开发说明

更细的架构与玩法设计见 **`game_01/docs/PROGRAM_DESIGN.md`**。

## 许可证

若后续需要开源协议，请在仓库中补充 `LICENSE` 文件。
