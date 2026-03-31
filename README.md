# onabreak

跨平台 **AI Agent 聊天客户端**，基于 [Tauri](https://v2.tauri.app/) 与 React。在桌面端统一管理 Claude Code、Codex、Cursor Agent 等 CLI 会话，并支持内置终端与本地数据持久化。

## 功能概览

- **工作区（Workspace）**：多工作区切换，会话与数据按工作区组织。
- **会话与标签**：多会话、多标签浏览；可配置默认提供者与快捷入口。
- **内置提供方**：Claude Code（`claude`）、OpenAI Codex（`codex`）、Cursor Agent（`cursor-agent`）、以及系统原生终端（PowerShell / CMD / WSL / Git Bash 等）。
- **终端集成**：通过 PTY 在应用内运行 CLI，适合与各类 AI Agent 命令行工具交互。
- **本地存储**：使用 SQLite（`onabreak.db`）保存工作区、会话与设置。
- **界面**：无边框窗口与自定义标题栏；全局快捷键（可在设置中调整）。
- **系统**：Windows 下支持任务栏角标等提示。

> 使用各 AI CLI 前，请先在系统中安装对应命令行工具并确保 `PATH` 可用。

## 技术栈


| 层级  | 技术                               |
| --- | -------------------------------- |
| 桌面壳 | Tauri 2                          |
| 前端  | React 18、TypeScript、Vite 6       |
| 样式  | Tailwind CSS                     |
| 状态  | Zustand                          |
| 数据  | `@tauri-apps/plugin-sql`（SQLite） |
| 终端  | `tauri-plugin-pty`、`xterm.js`    |


## 环境要求

- **Node.js**（建议 LTS）与 **npm**
- **Rust** 工具链（`[rustup](https://rustup.rs/)`），用于编译 Tauri 后端
- **系统依赖**：按 [Tauri 前置条件](https://v2.tauri.app/start/prerequisites/) 安装对应平台的构建依赖（Windows 需 MSVC 等）

## 开发

安装依赖并启动带热更新的桌面开发模式（会同时跑 Vite 与 Tauri）：

```bash
npm install
npm run tauri dev
```

仅调试前端（默认开发服务器端口与 `tauri.conf.json` 中 `devUrl` 一致，当前为 `http://localhost:1420`）：

```bash
npm run dev
```

## 构建

生成前端静态资源并打包桌面应用：

```bash
npm run tauri build
```

当前配置中 Windows 安装包目标为 **NSIS**（见 `src-tauri/tauri.conf.json` 的 `bundle.targets`）。产物位于 `src-tauri/target/release/`（及 `bundle` 子目录中的安装包）。

## 项目结构（简要）

```
src/                 # React 前端（组件、stores、lib）
src-tauri/           # Rust 后端与 Tauri 配置
  tauri.conf.json    # 应用标识、窗口、CSP、打包等
```

## 许可证

本项目采用 [MIT License](LICENSE) 授权。