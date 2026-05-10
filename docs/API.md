# API Reference

## Skills

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/skills` | Skill 列表（含 warningCount） |
| GET | `/api/skills/:id` | Skill 详情（含 instruction + warnings） |
| POST | `/api/skills/reload` | 重新加载 Skill（清除缓存） |

## Templates

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/templates` | 模板列表 |
| GET | `/api/templates/:id` | 模板详情（含 content + variables） |
| POST | `/api/templates/:id/render` | 渲染模板 `{ variables: {...} }` |

## Projects

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 `{ name, description? }` |
| GET | `/api/projects/:id` | 项目详情（含 stats） |
| DELETE | `/api/projects/:id` | 删除项目（仅空项目） |

## Files

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/projects/:projectId/files` | 文件列表 |
| POST | `/api/projects/:projectId/files` | 上传文件（multipart） |
| GET | `/api/files/:id` | 文件详情 |
| DELETE | `/api/files/:id` | 删除文件 |

## Run

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/run` | 执行 Agent（SSE 流式响应） |

请求体：
```json
{
  "goal": "string",
  "skillId": "string (optional)",
  "projectId": "string (optional)",
  "fileIds": ["string"] (optional),
  "templateId": "string (optional)",
  "templateVariables": { "key": "value" } (optional)
}
```

SSE 事件类型：
- `start` → `{ goalId }`
- `delta` → `{ content }`（增量文本）
- `artifact` → `{ id, type, title }`
- `error` → `{ error }`
- `done` → `{ status: "success" }`

## Artifacts

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/artifacts?projectId=&limit=` | Artifact 列表 |
| GET | `/api/artifacts/:id` | Artifact 详情 |
| GET | `/api/artifacts/:id/versions` | 版本链 |
| GET | `/api/artifacts/:id/export` | 导出下载 |
| POST | `/api/artifacts/:id/versions` | 手动创建新版本 |
| POST | `/api/artifacts/:id/refine` | AI Refine（SSE 流式） |
| POST | `/api/artifacts/:id/inline-edit` | AI 局部替换（JSON） |

### Inline Edit

```json
POST /api/artifacts/:id/inline-edit
{
  "selectedText": "选中的文本",
  "instruction": "修改要求",
  "beforeContext": "前文上下文（可选）",
  "afterContext": "后文上下文（可选）"
}

→ 200 { "replacement": "替换后的文本" }
→ 400 { "error": "selectedText and instruction are required" }
→ 404 { "error": "Artifact not found" }
```

## Runs

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/runs?projectId=&limit=` | Run 列表 |
| GET | `/api/runs/:id` | Run 详情（含 messages、artifacts、materializedFiles） |
| GET | `/api/runs/:id/files/:name` | 获取 Run 输出文件 |
| POST | `/api/runs/:id/cancel` | 取消正在执行的 Run |

## Agents

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/agents` | Agent 描述列表 |
| GET | `/api/agent-profiles` | Agent 配置详情（含权限、warnings） |
| POST | `/api/agent-profiles/reload` | 重新加载 Agent 配置 |

Run 请求中的 `agentId` 和 `approval` 字段：

```json
{
  "goal": "...",
  "agentId": "agent-name",
  "approval": { "approved": true, "permissionsHash": "..." }
}
```

## Debug

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/debug/prompt` | 预览组装后的 Prompt（不调用 LLM） |
