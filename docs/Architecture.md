# Architecture

## 三层结构

```
┌─────────────────────────────────────────────┐
│  apps/web (React + Vite + Tailwind)         │
│  Context/Reducer 状态管理，SSE 流式消费      │
├─────────────────────────────────────────────┤
│  apps/daemon (Hono + better-sqlite3)        │
│  REST API + SSE，Drizzle ORM                │
├─────────────────────────────────────────────┤
│  packages/contracts                         │
│  共享 TypeScript 类型定义                    │
└─────────────────────────────────────────────┘
```

## 核心类型关系

```
Project 1:N Goal
Goal 1:N Run
Run 1:N Message
Run 1:N Artifact
Artifact → Artifact (parentArtifactId, 版本链)
Project 1:N File
Project 1:N Artifact
```

## 关键模块

| 模块 | 路径 | 职责 |
|------|------|------|
| Agent Runner | `daemon/src/agent/run-agent.ts` | 组装 Prompt、流式调用 LLM、解析 Artifact、Inline Edit |
| Prompt Composer | `daemon/src/prompts/compose-prompt.ts` | Base Prompt + Skill + Refine 指令 |
| Inline Edit Prompt | `daemon/src/prompts/inline-edit-prompt.ts` | 局部替换专用 Prompt，约束 AI 只返回替换文本 |
| Skill Loader | `daemon/src/skills/skill-loader.ts` | 扫描 SKILL.md，缓存，校验 |
| Template Loader | `daemon/src/templates/template-loader.ts` | 扫描模板文件，变量替换 |
| Artifact Parser | `daemon/src/artifacts/parse-artifact.ts` | 从 LLM 输出中提取 `<artifact>` 标签 |
| Artifact File Scanner | `daemon/src/artifacts/scan-artifact-files.ts` | 扫描 `artifacts/` 目录，返回 `ScannedArtifactFile[]` |
| File Context | `daemon/src/skills/file-context.ts` | 从 DB 加载文件内容，格式化为 Prompt |
| Provider | `daemon/src/providers/openai-compatible.ts` | 原生 fetch 调用 OpenAI 兼容 API，SSE 解析 |
| Agent Profiles | `daemon/src/agents/profiles/` | Agent 配置加载、权限管理、CLI/ACP 适配器 |
| Agent Materialize | `daemon/src/agents/materialize.ts` | Agent 工作区初始化，创建 `artifacts/` 目录 |

## 数据库

SQLite（better-sqlite3），WAL 模式。启动时自动建表和迁移。

表：projects, goals, runs, messages, artifacts, files

## 前端状态

单个 `WorkspaceContext` + `useReducer`，无路由。所有状态集中管理。

## Agent 适配器

支持多种 Agent 后端，通过 `agent-profiles.yaml` 配置：

| 类型 | 说明 |
|------|------|
| `cli` | 命令行 Agent（如 Claude Code、Kimi Code），通过 stdin/stdout 交互 |
| `acp` | Agent Client Protocol，通过 HTTP/stdio 双通道通信 |

Agent 权限系统：每个 Agent 可配置 `readProjectFiles`、`writeArtifactFiles`、`networkAccess` 等权限，首次使用需用户审批。
