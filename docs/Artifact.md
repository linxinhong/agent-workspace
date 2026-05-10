# Artifact Protocol

## 什么是 Artifact

Artifact 是 Agent 生成的结构化产物，由 LLM 输出中的 `<artifact>` 标签解析而来。

## Artifact 类型

| 类型 | 说明 | 预览方式 |
|------|------|---------|
| `markdown` | Markdown 文档 | MarkdownRenderer 渲染 |
| `html` | HTML 页面 | iframe sandbox 隔离预览 |
| `json` | JSON 数据 | 原文显示 |
| `mermaid` | Mermaid 图表 | 原文显示 |
| `react` | React 组件 | 原文显示 |

## Artifact 标签格式

LLM 输出中的 Artifact 标签：

```html
<artifact type="markdown" title="文档标题">
Markdown 内容
</artifact>

<artifact type="html" title="页面名称">
HTML 内容
</artifact>
```

属性顺序不限，引号可选。解析器兼容各种格式变体。

## Artifact 数据模型

```typescript
interface Artifact {
  id: string
  type: ArtifactType
  title: string
  content: string
  parentArtifactId?: string  // 父版本 ID
  version?: number           // 版本号
  changeNote?: string        // 变更说明
  source?: ArtifactSource    // 来源：stdout | file | manual | template | refine | fallback | inline-edit
  sourcePath?: string        // 文件来源路径
  createdAt: string
}
```

## 版本链

通过 `parentArtifactId` 形成链式结构：

```
v1 (id:A) → v2 (id:B, parentArtifactId:A) → v3 (id:C, parentArtifactId:B)
```

- AI Refine 自动创建新版本
- 手动 Edit 保存为新版本
- 版本链可通过 `GET /api/artifacts/:id/versions` 查询

## 操作

| 操作 | 说明 |
|------|------|
| Preview | 按 type 渲染预览 |
| Copy | 复制 content 到剪贴板 |
| Download | 按 type 确定扩展名，触发浏览器下载 |
| Edit | 进入编辑模式，修改 title/content，带未保存提示和草稿恢复 |
| Inline AI Edit | 编辑模式下选中文本 → AI 生成替换 → diff 预览 → 确认替换 |
| Refine | AI 辅助修改，输入修改要求 |
| Export | 后端 `GET /api/artifacts/:id/export` |

## 文件来源（两层模型）

Agent 输出的 Artifact 有两种来源：

1. **文件层**：Agent 写入工作区 `artifacts/` 目录的文件，系统扫描并注册为 Artifact（`source: 'file'`）
2. **内联层**：从 LLM 输出中解析 `<artifact>` 标签生成的 Artifact（`source: 'stdout'`）

合并优先级：file > stdout > fallback，按 title 去重。

### Source 类型

| Source | 说明 |
|--------|------|
| `stdout` | 从 Agent stdout 解析的 `<artifact>` 标签 |
| `file` | 从 `artifacts/` 目录扫描的文件 |
| `refine` | AI Refine 创建的新版本 |
| `inline-edit` | Inline AI Edit 后保存的新版本 |
| `manual` | 手动编辑保存的新版本 |
| `template` | 从模板生成的 Artifact |
| `fallback` | 无 `<artifact>` 标签时，stdout 全文作为 fallback |

支持的文件类型：`.md`, `.html`, `.htm`, `.json`, `.mmd`, `.tsx`, `.txt`

## 文件扩展名映射

`markdown` → `.md`，`html` → `.html`，`json` → `.json`，`mermaid` → `.mmd`，`react` → `.tsx`
