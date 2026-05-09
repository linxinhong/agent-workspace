import { randomUUID } from 'node:crypto'
import { appendFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentEvent, Skill, Artifact } from '@agent-workspace/contracts'
import type { AgentAdapter, AgentRunInput } from './types.js'
import { materializeWorkspace } from './materialize.js'
import { parseArtifacts } from '../artifacts/parse-artifact.js'
import { BASE_PROMPT } from '../prompts/base-prompt.js'
import { stripAnsi } from './ansi.js'
import { registerActiveRun, unregisterActiveRun } from './active-runs.js'

interface CliRunDeps {
  goal: string
  skill?: Skill
  adapter: AgentAdapter
  projectId: string
  fileContext?: string
  templateContent?: string
  saveRun: (data: CliSaveRunData) => Promise<void>
}

export interface CliSaveRunData {
  goalId: string
  goal: string
  skillId?: string
  model: string
  messages: Array<{ role: string; content: string }>
  artifacts: Array<{ id: string; type: string; title: string; content: string; createdAt: string }>
  fullText: string
  agentId: string
  command: string
  cwd: string
  exitCode: number | null
  durationMs: number
  stdoutPath: string
  stderrPath: string
  resultPath: string
  timedOut: boolean
  cancelled: boolean
}

const SKIP_FILES = new Set(['PROMPT.md', 'SKILL.md', 'FILE_CONTEXT.md', 'TEMPLATE.md', 'stdout.log', 'stderr.log', 'result.json'])

export async function* runCliAgent(deps: CliRunDeps): AsyncGenerator<AgentEvent> {
  const goalId = randomUUID()
  const runId = goalId
  yield { type: 'start', goalId }

  // Compose system prompt
  const systemParts = [BASE_PROMPT]
  if (deps.skill?.instruction) {
    systemParts.push(deps.skill.instruction)
  }
  const systemPrompt = systemParts.join('\n\n')

  // Materialize workspace
  let workspaceDir: string
  try {
    workspaceDir = materializeWorkspace({
      runId,
      projectId: deps.projectId,
      systemPrompt,
      goal: deps.goal,
      skillInstruction: deps.skill?.instruction,
      fileContext: deps.fileContext,
      templateContent: deps.templateContent,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to materialize workspace'
    yield { type: 'error', error: message }
    return
  }

  const stdoutPath = join(workspaceDir, 'stdout.log')
  const stderrPath = join(workspaceDir, 'stderr.log')
  const resultPath = join(workspaceDir, 'result.json')

  const input: AgentRunInput = {
    goal: deps.goal,
    systemPrompt,
    skillInstruction: deps.skill?.instruction,
    fileContext: deps.fileContext,
    templateContent: deps.templateContent,
    workspaceDir,
  }

  const controller = new AbortController()
  registerActiveRun(runId, controller, deps.adapter)
  const timeout = setTimeout(() => controller.abort(), 120_000)

  const startedAt = Date.now()
  let fullText = ''
  let stderr = ''
  let exitCode: number | null = null
  let timedOut = false
  let cancelled = false

  try {
    for await (const event of deps.adapter.run(input, controller.signal)) {
      if (event.type === 'stdout') {
        const cleaned = stripAnsi(event.text)
        fullText += cleaned
        appendFileSync(stdoutPath, cleaned, 'utf-8')
        if (fullText.length > 100_000) {
          throw new Error('输出超过最大长度限制 (100KB)')
        }
        yield { type: 'delta', content: cleaned }
      } else if (event.type === 'stderr') {
        const cleaned = stripAnsi(event.text)
        stderr += cleaned
        appendFileSync(stderrPath, cleaned, 'utf-8')
      } else if (event.type === 'exit') {
        exitCode = event.code
      }
    }
  } catch (err) {
    if (controller.signal.aborted) {
      if (Date.now() - startedAt >= 119_000) {
        timedOut = true
      } else {
        cancelled = true
      }
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    yield { type: 'error', error: message }
    const durationMs = Date.now() - startedAt
    await writeResultAndSave(deps, {
      goalId, workspaceDir, stdoutPath, stderrPath, resultPath,
      fullText, stderr, exitCode, durationMs, timedOut, cancelled, startedAt,
      artifacts: [], status: 'error',
    })
    return
  } finally {
    clearTimeout(timeout)
    unregisterActiveRun(runId)
  }

  const durationMs = Date.now() - startedAt

  // Parse artifacts from stdout
  let parsedArtifacts = parseArtifacts(fullText)

  // No artifact fallback
  if (parsedArtifacts.length === 0 && fullText.trim()) {
    parsedArtifacts = [{
      id: randomUUID(),
      type: 'markdown' as const,
      title: 'Agent Output',
      content: fullText,
      createdAt: new Date().toISOString(),
    }]
  } else if (parsedArtifacts.length === 0 && !fullText.trim() && stderr.trim()) {
    // stdout empty, stderr has content → error, no artifact
    await writeResultAndSave(deps, {
      goalId, workspaceDir, stdoutPath, stderrPath, resultPath,
      fullText, stderr, exitCode, durationMs, timedOut, cancelled, startedAt,
      artifacts: [], status: 'error',
    })
    yield { type: 'error', error: `Agent exited without output. stderr: ${stderr.slice(0, 200)}` }
    return
  }

  // Scan workspace for additional artifact files
  const fileArtifacts = scanWorkspaceArtifacts(workspaceDir)
  parsedArtifacts = [...parsedArtifacts, ...fileArtifacts]

  for (const artifact of parsedArtifacts) {
    yield { type: 'artifact', artifact: artifact as Artifact }
  }

  await writeResultAndSave(deps, {
    goalId, workspaceDir, stdoutPath, stderrPath, resultPath,
    fullText, stderr, exitCode, durationMs, timedOut, cancelled, startedAt,
    artifacts: parsedArtifacts, status: 'completed',
  })

  yield { type: 'done' }
}

async function writeResultAndSave(
  deps: CliRunDeps,
  info: {
    goalId: string
    workspaceDir: string
    stdoutPath: string
    stderrPath: string
    resultPath: string
    fullText: string
    stderr: string
    exitCode: number | null
    durationMs: number
    timedOut: boolean
    cancelled: boolean
    startedAt: number
    artifacts: Array<{ id: string; type: string; title: string; content: string; createdAt: string }>
    status: string
  },
) {
  // Write result.json
  writeFileSync(info.resultPath, JSON.stringify({
    runId: info.goalId,
    agentId: deps.adapter.id,
    agentKind: 'cli',
    command: '',
    cwd: info.workspaceDir,
    exitCode: info.exitCode,
    status: info.status,
    startedAt: new Date(info.startedAt).toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: info.durationMs,
    artifactCount: info.artifacts.length,
    timedOut: info.timedOut,
    cancelled: info.cancelled,
  }, null, 2), 'utf-8')

  await deps.saveRun({
    goalId: info.goalId,
    goal: deps.goal,
    skillId: deps.skill?.id,
    model: deps.adapter.id,
    messages: info.status === 'completed'
      ? [{ role: 'user', content: deps.goal }]
      : [],
    artifacts: info.artifacts.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      content: a.content,
      createdAt: a.createdAt,
    })),
    fullText: info.fullText,
    agentId: deps.adapter.id,
    command: '',
    cwd: info.workspaceDir,
    exitCode: info.exitCode,
    durationMs: info.durationMs,
    stdoutPath: info.stdoutPath,
    stderrPath: info.stderrPath,
    resultPath: info.resultPath,
    timedOut: info.timedOut,
    cancelled: info.cancelled,
  })
}

function scanWorkspaceArtifacts(workspaceDir: string): Artifact[] {
  const artifacts: Artifact[] = []
  try {
    const entries = readdirSync(workspaceDir)
    for (const entry of entries) {
      if (SKIP_FILES.has(entry)) continue

      const filePath = join(workspaceDir, entry)
      const stat = statSync(filePath)
      if (!stat.isFile()) continue
      if (stat.size > 1_000_000) continue

      const content = readFileSync(filePath, 'utf-8')
      const ext = entry.split('.').pop()?.toLowerCase()
      let type: string = 'markdown'
      if (ext === 'html' || ext === 'htm') type = 'html'
      else if (ext === 'json') type = 'json'

      artifacts.push({
        id: randomUUID(),
        type: type as any,
        title: entry,
        content,
        createdAt: new Date().toISOString(),
      })
    }
  } catch { /* workspace scan is best-effort */ }
  return artifacts
}
