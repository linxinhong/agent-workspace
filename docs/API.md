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

## Runs

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/runs?projectId=&limit=` | Run 列表 |

## Debug

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/debug/prompt` | 预览组装后的 Prompt（不调用 LLM） |
