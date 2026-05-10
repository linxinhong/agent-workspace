# Agent Workspace

基于 Project / Skill / Template / File Context / Artifact 的企业级 Agent 工作台。

## Features

- **Project Workspace** — 多项目管理，数据隔离
- **Skill Workspace** — 可查看、调试、热加载、校验的 Skill 系统
- **File Context** — 上传文件作为 Agent 上下文
- **Artifact Preview** — Markdown/HTML 实时预览
- **Artifact Refine** — AI 辅助修改 Artifact
- **Inline AI Edit** — 选中文本 → AI 生成替换 → diff 预览 → 确认替换
- **Artifact Versioning** — 版本链追踪，可回溯任意版本
- **Artifact Editor** — 源码级编辑，未保存提示 + 草稿自动恢复
- **Agent Adapters** — 支持 CLI（Claude Code、Kimi Code）和 ACP 协议
- **Agent Permissions** — 权限审批流程，安全管控
- **Templates** — 带变量的模板系统，一键生成或 Agent 优化
- **Export & Delivery** — 复制、下载、后端导出
- **Prompt Debugger** — 预览最终组装的 Prompt，调试 Skill 效果
- **Run Observability** — Run 详情、输出文件、stdout/stderr 预览

## Quick Start

```bash
pnpm install
pnpm dev
```

Daemon 默认运行在 `http://localhost:3000`，Web 通过 Vite 代理访问 API。

## Environment Variables

在项目根目录 `.env` 文件中配置：

```env
PROVIDER_API_KEY=your-api-key
PROVIDER_BASE_URL=https://api.openai.com/v1
PROVIDER_DEFAULT_MODEL=gpt-4.1
PORT=3000
```

支持任何 OpenAI 兼容的 API（DeepSeek、Moonshot、Ollama 等）。

## Architecture

```
Project → Goal → Skill + Template + File Context → Agent → Artifact
                                                     ↓
                                              Edit / Refine / Version
                                                     ↓
                                              Copy / Download / Export
```

### 数据流

1. 用户在项目中输入 Goal
2. 可选：选择 Skill、勾选文件、选择模板
3. 系统组装 Prompt（Base + Skill + Template + File Context + Goal）
4. Agent 通过 LLM 流式生成内容
5. 从输出中解析 `<artifact>` 标签生成 Artifact
6. Artifact 可预览、编辑、AI 修改、版本追踪、导出

## Directory Structure

```
apps/web/          # React 前端（Vite + Tailwind）
apps/daemon/       # Hono 后端（SQLite + Drizzle ORM）
packages/contracts/ # 共享 TypeScript 类型
skills/            # Skill 定义（SKILL.md 文件）
templates/         # Artifact 模板（带变量）
docs/              # 文档
.workspace/        # SQLite 数据库 + 上传文件（gitignore）
```

## Release History

| 版本 | 内容 |
|------|------|
| v0.2.0 | Inline AI Edit + diff 预览、Agent 适配器 + 权限审批、标准化 Artifact 输出、编辑器未保存保护 + 草稿恢复 |
| v0.1.0 | 核心生成链路、Artifact 版本/Refine、Project/Skill/File Workspace、Editor、Templates、Export |

## License

Private
