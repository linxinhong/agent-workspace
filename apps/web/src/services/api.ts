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

async function consumeSSE(res: Response, onEvent: (event: RunEvent) => void): Promise<void> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    let currentEvent = ''
    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.slice(6).trim()
      } else if (trimmed.startsWith('data:')) {
        const data = trimmed.slice(5).trim()
        try {
          onEvent({ type: currentEvent as RunEvent['type'], data: JSON.parse(data) })
        } catch {
          // Skip malformed
        }
      }
    }
  }
}

export async function fetchSkills(): Promise<SkillBrief[]> {
  const res = await fetch('/api/skills')
  return res.json()
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects')
  return res.json()
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  })
  return res.json()
}

export async function fetchProjectDetail(id: string): Promise<ProjectDetail> {
  const res = await fetch(`/api/projects/${id}`)
  return res.json()
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`/api/projects/${id}`, { method: 'DELETE' })
}

export async function fetchArtifactSummaries(opts: { limit?: number; projectId?: string } = {}): Promise<ArtifactSummary[]> {
  const params = new URLSearchParams()
  params.set('limit', String(opts.limit ?? 50))
  if (opts.projectId) params.set('projectId', opts.projectId)
  const res = await fetch(`/api/artifacts?${params}`)
  return res.json()
}

export async function fetchArtifact(id: string): Promise<Artifact> {
  const res = await fetch(`/api/artifacts/${id}`)
  return res.json()
}

export function getArtifactExportUrl(id: string): string {
  return `/api/artifacts/${id}/export`
}

export async function fetchArtifactVersions(id: string): Promise<Artifact[]> {
  const res = await fetch(`/api/artifacts/${id}/versions`)
  return res.json()
}

export async function createArtifactVersion(id: string, data: {
  content: string
  title?: string
  changeNote?: string
  source?: string
}): Promise<Artifact> {
  const res = await fetch(`/api/artifacts/${id}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? `HTTP ${res.status}`) }
  return res.json()
}

export async function fetchRuns(opts: { limit?: number; projectId?: string } = {}): Promise<RunSummary[]> {
  const params = new URLSearchParams()
  params.set('limit', String(opts.limit ?? 20))
  if (opts.projectId) params.set('projectId', opts.projectId)
  const res = await fetch(`/api/runs?${params}`)
  return res.json()
}

export async function fetchProjectFiles(projectId: string): Promise<WorkspaceFile[]> {
  const res = await fetch(`/api/projects/${projectId}/files`)
  return res.json()
}

export async function fetchFile(id: string): Promise<WorkspaceFile> {
  const res = await fetch(`/api/files/${id}`)
  return res.json()
}

export async function uploadFile(projectId: string, file: File): Promise<{ id: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/projects/${projectId}/files`, { method: 'POST', body: form })
  if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? `HTTP ${res.status}`) }
  return res.json()
}

export async function deleteFile(id: string): Promise<void> {
  await fetch(`/api/files/${id}`, { method: 'DELETE' })
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
    const err = await res.json()
    throw new Error(err.error ?? `HTTP ${res.status}`)
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
    const err = await res.json()
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  await consumeSSE(res, input.onEvent)
}

export async function fetchAgents(): Promise<AgentDescriptor[]> {
  const res = await fetch('/api/agents')
  return res.json()
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
  const res = await fetch('/api/agent-profiles')
  return res.json()
}

export async function reloadAgentProfiles(): Promise<{ ok: boolean }> {
  const res = await fetch('/api/agent-profiles/reload', { method: 'POST' })
  return res.json()
}

export async function fetchSkillDetail(id: string): Promise<SkillDetail> {
  const res = await fetch(`/api/skills/${id}`)
  if (!res.ok) throw new Error('Skill not found')
  return res.json()
}

export async function reloadSkills(): Promise<{ count: number }> {
  const res = await fetch('/api/skills/reload', { method: 'POST' })
  return res.json()
}

export async function fetchDebugPrompt(params: {
  goal: string
  skillId?: string
  projectId?: string
  fileIds?: string[]
}): Promise<{ messages: Array<{ role: string; content: string }> }> {
  const res = await fetch('/api/debug/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? `HTTP ${res.status}`) }
  return res.json()
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
  const res = await fetch(`/api/runs/${id}`)
  if (!res.ok) throw new Error('Run not found')
  return res.json()
}

export async function fetchRunFile(runId: string, name: string): Promise<string> {
  const res = await fetch(`/api/runs/${runId}/files/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error('File not found')
  return res.text()
}

export async function cancelRun(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/runs/${id}/cancel`, { method: 'POST' })
  if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? `HTTP ${res.status}`) }
  return res.json()
}

export async function fetchTemplates(): Promise<TemplateBrief[]> {
  const res = await fetch('/api/templates')
  return res.json()
}

export async function fetchTemplateDetail(id: string): Promise<ArtifactTemplate> {
  const res = await fetch(`/api/templates/${id}`)
  if (!res.ok) throw new Error('Template not found')
  return res.json()
}

export async function renderTemplate(id: string, variables: Record<string, string>): Promise<{ type: string; title: string; content: string }> {
  const res = await fetch(`/api/templates/${id}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variables }),
  })
  if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? `HTTP ${res.status}`) }
  return res.json()
}

export async function inlineEditArtifact(input: {
  artifactId: string
  selectedText: string
  instruction: string
  beforeContext?: string
  afterContext?: string
}): Promise<{ replacement: string }> {
  const res = await fetch(`/api/artifacts/${input.artifactId}/inline-edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selectedText: input.selectedText,
      instruction: input.instruction,
      beforeContext: input.beforeContext,
      afterContext: input.afterContext,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    try { const err = JSON.parse(text); throw new Error(err.error ?? `HTTP ${res.status}`) } catch (e) { if (e instanceof Error && e.message !== `HTTP ${res.status}`) throw e; throw new Error(text || `HTTP ${res.status}`) }
  }
  return res.json()
}
