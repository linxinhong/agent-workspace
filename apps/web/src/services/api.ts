import type { Artifact, ArtifactType, ArtifactSummary } from '@agent-workspace/contracts'

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
  createdAt: string
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

export async function fetchArtifactSummaries(limit = 50): Promise<ArtifactSummary[]> {
  const res = await fetch(`/api/artifacts?limit=${limit}`)
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

export async function fetchRuns(limit = 20): Promise<RunSummary[]> {
  const res = await fetch(`/api/runs?limit=${limit}`)
  return res.json()
}

export async function runAgentStream(input: {
  goal: string
  skillId?: string
  onEvent: (event: RunEvent) => void
}): Promise<void> {
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: input.goal, skillId: input.skillId }),
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
  onEvent: (event: RunEvent) => void
}): Promise<void> {
  const res = await fetch(`/api/artifacts/${input.artifactId}/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction: input.instruction, skillId: input.skillId }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  await consumeSSE(res, input.onEvent)
}
