# Design.md

# Agent Workspace Core Design

## 1. 项目的第一性原理

这个项目的本质不是聊天应用，也不是页面生成器。

它的本质是：

> 用户有一个目标，Agent 使用某种能力完成任务，并把结果沉淀成可继续使用的产物。

因此，系统最核心的对象只有四个：

```text
User Goal
Agent
Skill
Artifact

所有其他能力，例如项目管理、文件系统、模型 Provider、历史记录、预览、导出、权限系统，本质上都是围绕这四个对象展开的。

第一版只需要保证这条链路稳定：

Goal → Skill → Prompt → Agent → Artifact
2. 核心目标

第一版不追求大而全。

只做一件事：

用户输入一个目标，选择一个能力，让 Agent 生成一个可预览、可保存、可继续使用的 Artifact。

这就是项目的最小内核。

3. 核心对象
3.1 User Goal

User Goal 是用户想完成的目标。

用户输入的不是普通聊天消息，而是一个任务目标。

示例：

生成一个企业信息化平台首页
优化一份 MSS 安全事件通报
生成一个项目汇报 PPT 大纲
设计一个审批流程
分析一批告警数据

数据结构：

export interface UserGoal {
  id: string
  content: string
  skillId?: string
  createdAt: string
}

设计原则：

1. 用户输入应被视为任务，而不是普通消息
2. Goal 是一次 Agent 执行的起点
3. Goal 可以关联一个 Skill
4. Goal 后续可以扩展为 Project / Conversation 的一部分
3.2 Agent

Agent 是执行目标的主体。

Agent 不应该绑定具体模型，也不应该绑定具体业务。

Agent 的职责只有一个：

接收目标、上下文和 Skill，调用 Provider，产出结果。

数据结构：

export interface Agent {
  run(input: AgentRunInput): AsyncIterable<AgentEvent>
}

export interface AgentRunInput {
  goal: UserGoal
  skill?: Skill
  context?: string
  provider: AgentProvider
  model?: string
}

export interface AgentEvent {
  type: 'start' | 'delta' | 'artifact' | 'error' | 'done'
  content?: string
  artifact?: Artifact
  error?: string
}

设计原则：

1. Agent 只负责任务执行
2. Agent 不关心底层模型是谁
3. Agent 不直接处理具体业务规则
4. 具体业务能力由 Skill 定义
5. 模型调用由 Provider 负责
3.3 Skill

Skill 是能力定义。

Skill 不做运行逻辑，只定义：

这个能力做什么
应该如何做
应该输出什么
有什么约束

数据结构：

export interface Skill {
  id: string
  name: string
  description?: string
  instruction: string
  outputTypes: ArtifactType[]
}

Skill 目录：

skills/
├── web-ui-design/
│   └── SKILL.md
├── document-writer/
│   └── SKILL.md
└── mss-alert-report/
    └── SKILL.md

SKILL.md 示例：

---
id: web-ui-design
name: Web UI Design
description: 生成企业级 Web UI 原型和设计方案
output:
  - html
  - markdown
---

# Role

你是企业级 Web UI 设计专家。

# Goal

根据用户需求生成可落地的企业级 Web UI 方案。

# Workflow

1. 理解用户目标
2. 提炼页面信息架构
3. 设计核心布局
4. 生成可预览 Artifact
5. 给出必要说明

# Output Contract

必须输出 Artifact。

Artifact 格式：

<artifact type="html" title="页面名称">
HTML 内容
</artifact>

或：

<artifact type="markdown" title="设计说明">
Markdown 内容
</artifact>

# Constraints

- 信息密度适中到高
- 设计要现代化
- Agent 是一等公民
- 结果需要可预览
- 不要只输出抽象建议

设计原则：

1. 所有业务能力都应该 Skill 化
2. 主程序不写死业务规则
3. 新增能力时优先新增 SKILL.md
4. Skill 是 Prompt 的重要组成部分
5. Skill 应约束 Artifact 输出格式
3.4 Artifact

Artifact 是 Agent 的最终产物。

不要把模型输出只当成文本。

文本可以是过程，Artifact 才是结果。

支持类型：

export type ArtifactType =
  | 'markdown'
  | 'html'
  | 'json'
  | 'mermaid'
  | 'react'

数据结构：

export interface Artifact {
  id: string
  type: ArtifactType
  title: string
  content: string
  createdAt: string
}

统一输出协议：

<artifact type="markdown" title="方案文档">
内容
</artifact>
<artifact type="html" title="企业工作台首页">
<!DOCTYPE html>
<html>
...
</html>
</artifact>

设计原则：

1. Agent 的重要结果都应该 Artifact 化
2. Artifact 可以预览
3. Artifact 可以保存
4. Artifact 可以再次编辑和复用
5. 不同业务能力复用同一套 Artifact 协议
4. 最小核心闭环

第一版只需要跑通这个闭环：

User Goal
  ↓
Select Skill
  ↓
Compose Prompt
  ↓
Run Agent
  ↓
Stream Response
  ↓
Parse Artifact
  ↓
Preview Artifact
  ↓
Save Artifact

这个闭环是整个项目的核心。

任何功能如果不能强化这条链路，第一版都可以暂缓。

5. 最小系统架构
┌──────────────────────────────┐
│            Web App            │
│                              │
│  Goal Input                  │
│  Skill Selector              │
│  Chat Stream                 │
│  Artifact Preview            │
└───────────────┬──────────────┘
                │ HTTP / SSE
                ↓
┌──────────────────────────────┐
│          Daemon API           │
│                              │
│  Skill Loader                │
│  Prompt Composer             │
│  Agent Runner                │
│  Artifact Parser             │
│  Storage                     │
└───────────────┬──────────────┘
                │
                ↓
┌──────────────────────────────┐
│        Agent Provider         │
│                              │
│  OpenAI-compatible API        │
│  Local CLI later              │
└──────────────────────────────┘

第一版只需要六个模块：

1. Web App
2. Daemon API
3. Skill Loader
4. Prompt Composer
5. Agent Provider
6. Artifact Runtime
6. 模块设计
6.1 Web App

Web App 只负责四件事：

1. 输入目标
2. 选择 Skill
3. 展示 Agent 输出过程
4. 预览 Artifact

最小页面结构：

┌──────────────────────────────────────────┐
│ Header                                   │
├──────────────────────┬───────────────────┤
│ Chat / Goal Input    │ Artifact Preview  │
│                      │                   │
│ Skill Selector       │ Markdown / HTML   │
│ Stream Output        │                   │
└──────────────────────┴───────────────────┘

最小目录：

apps/web/
└── src/
    ├── App.tsx
    ├── components/
    │   ├── GoalInput.tsx
    │   ├── SkillSelector.tsx
    │   ├── ChatStream.tsx
    │   └── ArtifactPreview.tsx
    ├── services/
    │   └── api.ts
    └── types.ts

设计原则：

1. Web App 不处理复杂业务逻辑
2. Web App 不直接调用模型
3. Web App 通过 Daemon API 执行任务
4. Web App 负责良好的输入和预览体验
6.2 Daemon API

Daemon 是系统核心。

Daemon 只做五件事：

1. 加载 Skill
2. 组装 Prompt
3. 调用 Agent Provider
4. 解析 Artifact
5. 保存结果

最小目录：

apps/daemon/
└── src/
    ├── server.ts
    ├── routes/
    │   ├── run.ts
    │   ├── skills.ts
    │   └── artifacts.ts
    ├── skills/
    │   └── skill-loader.ts
    ├── prompts/
    │   └── compose-prompt.ts
    ├── agent/
    │   └── run-agent.ts
    ├── providers/
    │   └── openai-compatible.ts
    ├── artifacts/
    │   └── parse-artifact.ts
    └── storage/
        └── db.ts

设计原则：

1. Daemon 是本地能力边界
2. Daemon 负责统一调度
3. Daemon 隐藏 Provider 差异
4. Daemon 负责持久化
5. Daemon 对外提供简单 API
6.3 Skill Loader

Skill Loader 负责读取能力定义。

职责：

1. 扫描 skills 目录
2. 找到 SKILL.md
3. 解析 frontmatter
4. 读取正文 instruction
5. 返回 Skill 列表

接口：

export async function loadSkills(): Promise<Skill[]> {
  // 1. 扫描 skills 目录
  // 2. 找到 SKILL.md
  // 3. 解析 frontmatter
  // 4. 返回 Skill[]
}

设计原则：

1. Skill 文件化
2. Skill 可热加载
3. Skill 与主程序解耦
4. Skill 结构尽量简单
6.4 Prompt Composer

Prompt Composer 是系统的灵魂。

它负责把不同信息拼成最终系统提示词。

第一版只需要三层：

Base Prompt
+ Skill Instruction
+ User Goal

接口：

export function composePrompt(input: {
  basePrompt: string
  skill?: Skill
  goal: UserGoal
}) {
  return [
    input.basePrompt,
    input.skill?.instruction,
    `用户目标：${input.goal.content}`
  ]
    .filter(Boolean)
    .join('\n\n')
}

Base Prompt：

你是一个企业 Agent 工作台中的智能执行 Agent。

你的任务是根据用户目标，生成清晰、完整、可落地的结果。

当结果适合作为文档、页面、流程、数据或代码时，必须输出 Artifact。

Artifact 格式如下：

<artifact type="markdown" title="标题">
内容
</artifact>

或：

<artifact type="html" title="标题">
HTML 内容
</artifact>

要求：

1. 不要只输出空泛建议
2. 优先生成可保存、可预览的结果
3. 保持结构清晰
4. 面向企业级应用场景
5. 结果应尽量可以继续编辑和复用

设计原则：

1. Prompt 由系统统一组装
2. Skill 不直接调用模型
3. 用户输入不直接裸传给模型
4. 所有输出约束都通过 Prompt 明确
6.5 Agent Provider

Provider 是模型调用适配器。

第一版只做 OpenAI-compatible Provider。

接口：

export interface AgentProvider {
  run(input: {
    prompt: string
    model: string
  }): AsyncIterable<string>
}

后续再扩展：

OpenAI-compatible
Anthropic
Gemini
Local CLI
私有化模型

设计原则：

1. Agent 不关心底层模型是谁
2. Provider 屏蔽不同模型 API 差异
3. 第一版只保留最小接口
4. 后续可以支持多 Provider Registry
6.6 Agent Runner

Agent Runner 是任务执行器。

职责：

1. 接收 User Goal
2. 获取 Skill
3. 组装 Prompt
4. 调用 Provider
5. 流式返回 AgentEvent
6. 累积完整输出
7. 解析 Artifact
8. 保存结果

伪代码：

export async function* runAgent(input: AgentRunInput): AsyncIterable<AgentEvent> {
  yield { type: 'start' }

  const prompt = composePrompt({
    basePrompt,
    skill: input.skill,
    goal: input.goal
  })

  let fullText = ''

  for await (const delta of input.provider.run({
    prompt,
    model: input.model || 'default'
  })) {
    fullText += delta

    yield {
      type: 'delta',
      content: delta
    }
  }

  const artifacts = parseArtifacts(fullText)

  for (const artifact of artifacts) {
    yield {
      type: 'artifact',
      artifact
    }
  }

  yield { type: 'done' }
}

设计原则：

1. Runner 是 Goal 到 Artifact 的主流程
2. Runner 只编排，不写具体业务
3. Runner 的输出必须是事件流
4. Artifact 解析在完整输出后执行，后续再支持流式 Artifact
6.7 Artifact Parser

Artifact Parser 从模型输出中提取产物。

接口：

export function parseArtifacts(text: string): Artifact[] {
  const regex =
    /<artifact\s+type="([^"]+)"(?:\s+title="([^"]+)")?\s*>([\s\S]*?)<\/artifact>/g

  const artifacts: Artifact[] = []
  let match

  while ((match = regex.exec(text))) {
    artifacts.push({
      id: crypto.randomUUID(),
      type: match[1] as ArtifactType,
      title: match[2] || 'Untitled',
      content: match[3].trim(),
      createdAt: new Date().toISOString()
    })
  }

  return artifacts
}

设计原则：

1. Artifact 必须有明确边界
2. Parser 只解析协议，不理解业务
3. Parser 可以支持多个 Artifact
4. 第一版只解析完整输出
6.8 Artifact Preview

Artifact Preview 负责展示产物。

第一版只支持两种类型：

markdown
html

接口：

export function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  if (artifact.type === 'markdown') {
    return <MarkdownRenderer content={artifact.content} />
  }

  if (artifact.type === 'html') {
    return <HtmlSandbox content={artifact.content} />
  }

  return <pre>{artifact.content}</pre>
}

HTML 必须使用 sandbox iframe：

<iframe sandbox="allow-scripts" />

设计原则：

1. Artifact Preview 不负责生成内容
2. Artifact Preview 只根据 type 渲染
3. HTML 必须隔离运行
4. 不支持的类型先用纯文本展示
6.9 Storage

第一版只保存最核心数据：

goals
messages
artifacts

SQLite 表：

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  skill_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  type TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

设计原则：

1. 第一版只保存必要数据
2. Artifact 必须持久化
3. Message 可以用于回看过程
4. 后续再增加 Project / Conversation / Files / Runs
7. 最小 API 设计
7.1 获取 Skill 列表
GET /api/skills

响应：

[
  {
    "id": "web-ui-design",
    "name": "Web UI Design",
    "description": "生成企业级 Web UI",
    "outputTypes": ["html", "markdown"]
  }
]
7.2 执行 Agent
POST /api/run

请求：

{
  "goal": "生成一个企业信息化平台首页",
  "skillId": "web-ui-design",
  "model": "gpt-4.1"
}

响应：

SSE Stream

事件：

event: start
data: {"goalId":"goal-id"}

event: delta
data: {"content":"正在分析需求..."}

event: artifact
data: {"artifactId":"artifact-id","type":"html","title":"企业信息化平台首页"}

event: done
data: {"status":"success"}
7.3 获取 Artifact
GET /api/artifacts/:id

响应：

{
  "id": "artifact-id",
  "type": "html",
  "title": "企业信息化平台首页",
  "content": "<!DOCTYPE html>..."
}
8. 第一版目录结构
agent-workspace/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── components/
│   │       │   ├── GoalInput.tsx
│   │       │   ├── SkillSelector.tsx
│   │       │   ├── ChatStream.tsx
│   │       │   └── ArtifactPreview.tsx
│   │       ├── services/
│   │       │   └── api.ts
│   │       └── types.ts
│   └── daemon/
│       └── src/
│           ├── server.ts
│           ├── routes/
│           │   ├── run.ts
│           │   ├── skills.ts
│           │   └── artifacts.ts
│           ├── skills/
│           │   └── skill-loader.ts
│           ├── prompts/
│           │   └── compose-prompt.ts
│           ├── agent/
│           │   └── run-agent.ts
│           ├── providers/
│           │   └── openai-compatible.ts
│           ├── artifacts/
│           │   └── parse-artifact.ts
│           └── storage/
│               └── db.ts
├── packages/
│   └── contracts/
│       └── src/
│           ├── goal.ts
│           ├── skill.ts
│           ├── artifact.ts
│           ├── agent.ts
│           └── index.ts
├── skills/
│   ├── web-ui-design/
│   │   └── SKILL.md
│   ├── document-writer/
│   │   └── SKILL.md
│   └── mss-alert-report/
│       └── SKILL.md
├── .workspace/
│   └── app.sqlite
├── package.json
├── pnpm-workspace.yaml
└── Design.md
9. MVP 范围

第一版必须做：

1. 输入目标
2. 选择 Skill
3. 调用模型
4. 流式返回
5. 解析 Artifact
6. 预览 Markdown / HTML
7. 保存 Artifact

第一版不做：

1. 多人协作
2. 权限系统
3. 插件市场
4. 工作流编排
5. 文件知识库
6. 本地 CLI Agent
7. PPT 导出
8. 复杂项目管理
9. 多租户
10. 云端同步
10. 第一批 Skill
10.1 web-ui-design

用途：

企业 Web UI 生成
信息化平台页面设计
管理后台原型设计
工作台首页设计

输出：

html
markdown
10.2 document-writer

用途：

方案文档
产品说明
需求文档
项目计划
制度文档

输出：

markdown
10.3 mss-alert-report

用途：

安全事件通报优化
MSS 告警转正式通报
安全日报生成
告警字段清洗

输出：

markdown
11. 实现顺序
1. 定义 contracts 类型
2. 初始化 monorepo
3. 实现 daemon /api/skills
4. 实现 Skill Loader
5. 创建第一批 SKILL.md
6. 实现 Prompt Composer
7. 实现 OpenAI-compatible Provider
8. 实现 daemon /api/run SSE
9. 实现 Artifact Parser
10. 实现 Web GoalInput
11. 实现 Web SkillSelector
12. 实现 Web ChatStream
13. 实现 Web ArtifactPreview
14. 接入 SQLite
15. 保存 Goal / Message / Artifact
16. 打磨基础 UI
12. 开发判断标准

开发过程中只问三个问题。

12.1 是否帮助用户完成目标？

如果不能帮助用户完成目标，第一版不做。

12.2 是否可以 Skill 化？

如果是业务能力，就应该 Skill 化。

不要把业务规则写死在主程序里。

12.3 是否可以 Artifact 化？

如果结果可以被保存、预览、复用，就应该 Artifact 化。

不要只把它当聊天文本。

13. 后续扩展方向

核心闭环跑通后，再逐步扩展。

13.1 Project

引入项目空间：

Project
Conversation
Files
Runs
Artifacts
13.2 Provider Registry

支持多模型：

OpenAI-compatible
Anthropic
Gemini
Local CLI
私有化模型
13.3 More Artifact Types

扩展更多产物类型：

react
mermaid
json
table
dashboard
ppt
workflow
13.4 File Context

支持文件作为上下文：

上传文档
读取项目文件
引用历史 Artifact
生成基于文件的结果
13.5 Workflow

支持多步骤任务：

Plan
Execute
Review
Refine
Export
14. 安全边界

第一版也要保留基本安全边界。

14.1 API Key
1. API Key 不写入前端代码
2. API Key 不进入浏览器 LocalStorage
3. API Key 由 Daemon 读取环境变量
4. 日志中禁止打印 API Key
14.2 HTML Preview

HTML Artifact 必须使用 sandbox iframe。

<iframe sandbox="allow-scripts" />

默认不要开启：

allow-same-origin
allow-forms
allow-popups
allow-top-navigation
14.3 文件访问

第一版如果没有文件能力，可以暂不开放文件访问。

后续开放时必须限制在：

.workspace/

禁止访问：

系统目录
用户密钥目录
任意绝对路径
15. 最终总结

这个项目的第一版不是要做一个大平台。

它只需要做好一条核心链路：

Goal → Skill → Prompt → Agent → Artifact

也就是：

用户输入目标
选择一个能力
系统组装 Prompt
Agent 执行
生成 Artifact
预览 Artifact
保存 Artifact

只要这条链路稳定，后面的项目管理、多模型、文件知识库、工作流、权限系统、导出能力，都可以自然生长。

最终目标：

让企业内部的各种智能化能力，都能以 Skill 的方式接入，以 Agent 的方式使用，以 Artifact 的方式沉淀。
