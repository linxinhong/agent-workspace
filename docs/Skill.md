# Skill System

## 什么是 Skill

Skill 是 Agent 的能力定义。每个 Skill 是一个目录下的 `SKILL.md` 文件，包含 frontmatter 元数据和 instruction 正文。

## 目录结构

```
skills/
├── document-writer/
│   └── SKILL.md
├── mss-alert-report/
│   └── SKILL.md
└── web-ui-design/
    └── SKILL.md
```

## SKILL.md 格式

```markdown
---
id: my-skill
name: My Skill
description: 技能描述
output:
  - markdown
  - html
---

# Role
你是...

# Goal
根据用户需求...

# Workflow
1. 步骤一
2. 步骤二

# Output Contract
必须输出 Artifact。

<artifact type="markdown" title="标题">
内容
</artifact>

# Constraints
- 约束一
- 约束二
```

## Frontmatter 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 否 | 默认用目录名 |
| `name` | 否 | 默认用目录名 |
| `description` | 否 | 简短描述 |
| `output` | 否 | ArtifactType 数组，默认 `['markdown']` |

## 推荐结构

Skill 的 instruction 建议包含以下章节：

- **Role** — 角色定义
- **Goal** — 目标描述
- **Workflow** — 工作流程（编号列表）
- **Output Contract** — 输出要求和 Artifact 格式
- **Constraints** — 约束条件

## 校验

系统自动检查以下项目并给出 warning：

- 必须有 "Output Contract" 章节
- 建议有 "Role"、"Goal"、"Workflow"、"Constraints" 章节
- 建议定义 output 类型

## 热加载

修改 SKILL.md 后，在前端点击 "Reload" 按钮或调用 `POST /api/skills/reload`，无需重启 Daemon。

## Prompt 集成

Skill instruction 会被追加到 system prompt：

```
Base Prompt + Skill Instruction → System Message
```

可通过 Prompt Debugger 预览最终组装结果。
