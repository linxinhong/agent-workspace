import { randomUUID } from 'node:crypto'
import type { UserGoal, Skill, Artifact, AgentEvent } from '@agent-workspace/contracts'
import { composeMessages, composeRefineMessages } from '../prompts/compose-prompt'
import { runOpenAI, type OpenAIProviderConfig } from '../providers/openai-compatible'
import { parseArtifacts } from '../artifacts/parse-artifact'

interface RunAgentDeps {
  goal: UserGoal
  skill?: Skill
  model: string
  providerConfig: OpenAIProviderConfig
  saveRun: (data: SaveRunData) => Promise<void>
}

export interface SaveRunData {
  goal: UserGoal
  model: string
  skillId?: string
  messages: Array<{ role: string; content: string }>
  artifacts: Array<{ id: string; type: string; title: string; content: string; parentArtifactId?: string; version?: number; createdAt: string }>
  fullText: string
}

export async function* runAgent(deps: RunAgentDeps): AsyncGenerator<AgentEvent> {
  const goalId = deps.goal.id
  yield { type: 'start', goalId }

  const messages = composeMessages({ skill: deps.skill, goal: deps.goal })
  let fullText = ''

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    for await (const delta of runOpenAI(
      { messages, model: deps.model },
      deps.providerConfig,
      controller.signal,
    )) {
      fullText += delta
      if (fullText.length > 100_000) {
        throw new Error('输出超过最大长度限制 (100KB)')
      }
      yield { type: 'delta', content: delta }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    yield { type: 'error', error: message }

    await deps.saveRun({
      goal: deps.goal,
      model: deps.model,
      skillId: deps.skill?.id,
      messages,
      artifacts: [],
      fullText,
    })

    return
  } finally {
    clearTimeout(timeout)
  }

  const artifacts = parseArtifacts(fullText)

  for (const artifact of artifacts) {
    yield { type: 'artifact', artifact }
  }

  await deps.saveRun({
    goal: deps.goal,
    model: deps.model,
    skillId: deps.skill?.id,
    messages,
    artifacts: artifacts.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      content: a.content,
      createdAt: a.createdAt,
    })),
    fullText,
  })

  yield { type: 'done' }
}

export async function* runRefine(deps: {
  originalArtifact: Artifact
  instruction: string
  skill?: Skill
  model: string
  providerConfig: OpenAIProviderConfig
  saveRun: (data: SaveRunData) => Promise<void>
}): AsyncGenerator<AgentEvent> {
  const goalId = deps.originalArtifact.id
  yield { type: 'start', goalId }

  const messages = composeRefineMessages({
    skill: deps.skill,
    originalArtifact: deps.originalArtifact,
    instruction: deps.instruction,
  })

  let fullText = ''

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    for await (const delta of runOpenAI(
      { messages, model: deps.model },
      deps.providerConfig,
      controller.signal,
    )) {
      fullText += delta
      if (fullText.length > 100_000) {
        throw new Error('输出超过最大长度限制 (100KB)')
      }
      yield { type: 'delta', content: delta }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    yield { type: 'error', error: message }
    return
  } finally {
    clearTimeout(timeout)
  }

  const parsed = parseArtifacts(fullText)
  const parentVersion = deps.originalArtifact.version ?? 1

  for (const artifact of parsed) {
    yield { type: 'artifact', artifact }
  }

  const goal: UserGoal = {
    id: randomUUID(),
    content: `[Refine] ${deps.instruction}`,
    createdAt: new Date().toISOString(),
  }

  await deps.saveRun({
    goal,
    model: deps.model,
    skillId: deps.skill?.id,
    messages,
    artifacts: parsed.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      content: a.content,
      parentArtifactId: deps.originalArtifact.id,
      version: parentVersion + 1,
      createdAt: a.createdAt,
    })),
    fullText,
  })

  yield { type: 'done' }
}
