# Template System

## 什么是 Template

Template 是带变量的 Artifact 初始内容。用户选择模板 → 填写变量 → 一键生成或交给 Agent 优化。

## 目录结构

```
templates/
├── mss-alert-report/
│   └── security-incident-report.md
├── document-writer/
│   └── project-proposal.md
└── web-ui-design/
    └── enterprise-dashboard.html
```

子目录名对应关联的 Skill ID（可选）。

## 模板文件格式

```markdown
---
id: my-template
name: 模板名称
description: 模板描述
type: markdown
skillId: my-skill
variables:
  - name: customerName
    label: 客户名称
    type: text
    required: true
  - name: riskLevel
    label: 风险等级
    type: select
    options:
      - 低危
      - 中危
      - 高危
  - name: detail
    label: 详情
    type: textarea
---

# 标题

尊敬的 {{customerName}}：

风险等级：{{riskLevel}}

{{detail}}
```

## Frontmatter 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 否 | 默认 `目录名/文件名` |
| `name` | 否 | 默认用文件名 |
| `description` | 否 | 模板描述 |
| `type` | 否 | `markdown` 或 `html`，默认根据文件后缀 |
| `skillId` | 否 | 关联的 Skill ID |
| `variables` | 否 | 变量定义数组 |

## Variable 定义

```yaml
variables:
  - name: varName        # 变量名，用于 {{varName}}
    label: 显示名称      # 表单标签
    type: text           # text | textarea | select
    required: false      # 是否必填
    defaultValue: ""     # 默认值
    options: []          # select 类型的选项列表
```

## 变量语法

使用双花括号：`{{variableName}}`

渲染时替换为用户填写的值。未填写的变量保留原样。

## 使用方式

1. **直接创建** — 填写变量后渲染模板，直接生成 Artifact
2. **交给 Agent 优化** — 将渲染后的模板内容注入 Agent Prompt，让 LLM 基于模板优化

## 新增模板

1. 在 `templates/` 下创建目录和 `.md` 或 `.html` 文件
2. 编写 frontmatter 和模板内容
3. 无需重启，Template Loader 无缓存（每次请求重新加载）
