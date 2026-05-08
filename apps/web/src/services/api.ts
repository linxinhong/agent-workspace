import type { Artifact, ArtifactType, ArtifactSummary, Project, WorkspaceFile } from '@agent-workspace/contracts'

export interface SkillBrief {
  id: string
  name: string
  description?: string
  outputTypes: ArtifactType[]
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

export async function fetchArtifactVersions(id: string): Promise<Artifact[]> {
  const res = await fetch(`/api/artifacts/${id}/versions`)
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
  onEvent: (event: RunEvent) => void
}): Promise<void> {
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: input.goal, skillId: input.skillId, projectId: input.projectId, fileIds: input.fileIds }),
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
