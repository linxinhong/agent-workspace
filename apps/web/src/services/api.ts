import type { AgentDescriptor, Artifact, ArtifactType, ArtifactSummary, ArtifactTemplate, Project, SkillDetail, SkillWarning, WorkspaceFile } from '@agent-workspace/contracts'

export interface SkillBrief {
  id: string
  name: string
  description?: string
  outputTypes: ArtifactType[]
  warningCount: number
}

export interface RunEvent {
  type: 'start' | 'delta' | 'artifact' | 'error' | 'done'
  data: Record<string, unknown>
}

export interface RunSummary {
  id: string
  goalId: string
  goalContent: string | null
  skillId: string | null
  model: string | null
  status: string
  projectId: string | null
  createdAt: string
}

export interface ProjectDetail extends Project {
  artifactCount: number
  runCount: number
}

async function parseErrorResponse(res: Response): Promise<string> {
  const fallback = `HTTP ${res.status}`
  const text = await res.text().catch(() => '')
  if (!text) return fallback

  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown }
    if (typeof parsed.error === 'string') return parsed.error
    if (typeof parsed.message === 'string') return parsed.message
  } catch {
    // Fall through to plain text.
  }

  return text || fallback
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : '网络请求失败')
  }

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res))
  }

  if (res.status === 204) {
    return undefined as T
  }

  try {
    return await res.json() as T
  } catch {
    throw new Error('响应不是有效的 JSON')
  }
}

async function consumeSSE(res: Response, onEvent: (event: RunEvent) => void): Promise<void> {
  if (!res.body) throw new Error('响应不包含流数据')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = 'message'
  let dataLines: string[] = []

  const dispatchEvent = () => {
    if (dataLines.length === 0) {
      eventName = 'message'
      return
    }

    const data = dataLines.join('\n')
    const type = eventName as RunEvent['type']
    dataLines = []
    eventName = 'message'

    if (!['start', 'delta', 'artifact', 'error', 'done'].includes(type)) return

    try {
      onEvent({ type, data: JSON.parse(data) })
    } catch {
      // Ignore malformed event payloads but keep the stream alive.
    }
  }

  const processLine = (line: string) => {
    const trimmedLine = line.endsWith('\r') ? line.slice(0, -1) : line
    if (trimmedLine === '') {
      dispatchEvent()
      return
    }
    if (trimmedLine.startsWith(':')) return

    const separator = trimmedLine.indexOf(':')
    const field = separator === -1 ? trimmedLine : trimmedLine.slice(0, separator)
    let value = separator === -1 ? '' : trimmedLine.slice(separator + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    if (field === 'event') {
      eventName = value || 'message'
    } else if (field === 'data') {
      dataLines.push(value)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      processLine(line)
    }
  }

  buffer += decoder.decode()
  if (buffer) processLine(buffer)
  dispatchEvent()
}

export async function fetchSkills(): Promise<SkillBrief[]> {
  return request<SkillBrief[]>('/api/skills')
}

export async function fetchProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects')
}

export async function createProject(name: string, description?: string): Promise<Project> {
  return request<Project>('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  })
}

export async function fetchProjectDetail(id: string): Promise<ProjectDetail> {
  return request<ProjectDetail>(`/api/projects/${id}`)
}

export async function deleteProject(id: string): Promise<void> {
  await request<void>(`/api/projects/${id}`, { method: 'DELETE' })
}

export async function fetchArtifactSummaries(opts: { limit?: number; projectId?: string } = {}): Promise<ArtifactSummary[]> {
  const params = new URLSearchParams()
  params.set('limit', String(opts.limit ?? 50))
  if (opts.projectId) params.set('projectId', opts.projectId)
  return request<ArtifactSummary[]>(`/api/artifacts?${params}`)
}

export async function fetchArtifact(id: string): Promise<Artifact> {
  return request<Artifact>(`/api/artifacts/${id}`)
}

export function getArtifactExportUrl(id: string): string {
  return `/api/artifacts/${id}/export`
}

export async function fetchArtifactVersions(id: string): Promise<Artifact[]> {
  return request<Artifact[]>(`/api/artifacts/${id}/versions`)
}

export async function createArtifactVersion(id: string, data: {
  content: string
  title?: string
  changeNote?: string
  source?: string
}): Promise<Artifact> {
  return request<Artifact>(`/api/artifacts/${id}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function fetchRuns(opts: { limit?: number; projectId?: string } = {}): Promise<RunSummary[]> {
  const params = new URLSearchParams()
  params.set('limit', String(opts.limit ?? 20))
  if (opts.projectId) params.set('projectId', opts.projectId)
  return request<RunSummary[]>(`/api/runs?${params}`)
}

export async function fetchProjectFiles(projectId: string): Promise<WorkspaceFile[]> {
  return request<WorkspaceFile[]>(`/api/projects/${projectId}/files`)
}

export async function fetchFile(id: string): Promise<WorkspaceFile> {
  return request<WorkspaceFile>(`/api/files/${id}`)
}

export async function uploadFile(projectId: string, file: File): Promise<{ id: string } | WorkspaceFile> {
  const form = new FormData()
  form.append('file', file)
  return request<{ id: string } | WorkspaceFile>(`/api/projects/${projectId}/files`, { method: 'POST', body: form })
}

export async function deleteFile(id: string): Promise<void> {
  await request<void>(`/api/files/${id}`, { method: 'DELETE' })
}

export async function runAgentStream(input: {
  goal: string
  skillId?: string
  projectId?: string
  fileIds?: string[]
  templateId?: string
  templateVariables?: Record<string, string>
  agentId?: string
  approval?: { approved: boolean; permissionsHash: string }
  onEvent: (event: RunEvent) => void
}): Promise<void> {
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: input.goal, skillId: input.skillId, projectId: input.projectId,
      fileIds: input.fileIds, templateId: input.templateId, templateVariables: input.templateVariables,
      agentId: input.agentId, approval: input.approval,
    }),
  })

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res))
  }

  await consumeSSE(res, input.onEvent)
}

export async function refineArtifactStream(input: {
  artifactId: string
  instruction: string
  skillId?: string
  fileIds?: string[]
  onEvent: (event: RunEvent) => void
}): Promise<void> {
  const res = await fetch(`/api/artifacts/${input.artifactId}/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction: input.instruction, skillId: input.skillId, fileIds: input.fileIds }),
  })

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res))
  }

  await consumeSSE(res, input.onEvent)
}

export async function fetchAgents(): Promise<AgentDescriptor[]> {
  return request<AgentDescriptor[]>('/api/agents')
}

export interface AgentPermissions {
  readProjectFiles: boolean
  writeArtifactFiles: boolean
  writeProjectFiles: boolean
  networkAccess: boolean
  executeCommands: boolean
  requiresApproval: boolean
  sendsDataToRemote?: boolean
  remoteEndpoint?: string
}

export interface AgentProfileInfo {
  id: string
  name: string
  kind: string
  description?: string
  command?: string
  inputMode?: string
  timeoutMs?: number
  enabled?: boolean
  acpEndpoint?: string
  acpAgentId?: string
  permissions?: AgentPermissions
  permissionsHash?: string
  available: boolean
  warnings: string[]
}

export async function fetchAgentProfiles(): Promise<AgentProfileInfo[]> {
  return request<AgentProfileInfo[]>('/api/agent-profiles')
}

export async function reloadAgentProfiles(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/agent-profiles/reload', { method: 'POST' })
}

export async function fetchSkillDetail(id: string): Promise<SkillDetail> {
  return request<SkillDetail>(`/api/skills/${id}`)
}

export async function reloadSkills(): Promise<{ count: number }> {
  return request<{ count: number }>('/api/skills/reload', { method: 'POST' })
}

export async function fetchDebugPrompt(params: {
  goal: string
  skillId?: string
  projectId?: string
  fileIds?: string[]
}): Promise<{ messages: Array<{ role: string; content: string }> }> {
  return request<{ messages: Array<{ role: string; content: string }> }>('/api/debug/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export interface TemplateBrief {
  id: string
  name: string
  description?: string
  type: ArtifactType
  skillId?: string
  variableCount: number
}

export interface RunDetail {
  id: string
  goalId: string
  goal: string | null
  skillId: string | null
  model: string | null
  status: string
  projectId: string | null
  createdAt: string
  messages: Array<{ id: string; role: string; content: string; createdAt: string }>
  artifacts: Array<ArtifactSummary & { source?: string; sourcePath?: string }>
  agentId: string | null
  agentKind: string | null
  command: string | null
  cwd: string | null
  exitCode: number | null
  durationMs: number | null
  timedOut: number | null
  cancelled: number | null
  stdoutPath: string | null
  stderrPath: string | null
  stdoutPreview?: string
  stderrPreview?: string
  materializedFiles: Array<{ name: string; size: number; kind: string }>
}

export async function fetchRunDetail(id: string): Promise<RunDetail> {
  return request<RunDetail>(`/api/runs/${id}`)
}

export async function fetchRunFile(runId: string, name: string): Promise<string> {
  const res = await fetch(`/api/runs/${runId}/files/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(await parseErrorResponse(res))
  return res.text()
}

export async function cancelRun(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/runs/${id}/cancel`, { method: 'POST' })
}

export async function fetchTemplates(): Promise<TemplateBrief[]> {
  return request<TemplateBrief[]>('/api/templates')
}

export async function fetchTemplateDetail(id: string): Promise<ArtifactTemplate> {
  return request<ArtifactTemplate>(`/api/templates/${id}`)
}

export async function renderTemplate(id: string, variables: Record<string, string>): Promise<{ type: string; title: string; content: string }> {
  return request<{ type: string; title: string; content: string }>(`/api/templates/${id}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variables }),
  })
}

export async function inlineEditArtifact(input: {
  artifactId: string
  selectedText: string
  instruction: string
  beforeContext?: string
  afterContext?: string
}): Promise<{ replacement: string }> {
  return request<{ replacement: string }>(`/api/artifacts/${input.artifactId}/inline-edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selectedText: input.selectedText,
      instruction: input.instruction,
      beforeContext: input.beforeContext,
      afterContext: input.afterContext,
    }),
  })
}
