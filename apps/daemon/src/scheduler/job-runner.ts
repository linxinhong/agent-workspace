import { randomUUID } from 'node:crypto'
import { appendFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ScheduledJob, Artifact, DeliveryConfig } from '@agent-workspace/contracts'
import { db, DEFAULT_PROJECT_ID } from '../storage/db'
import { goals, runs, artifacts, scheduledJobExecutions, scheduledJobs } from '../storage/schema'
import { eq } from 'drizzle-orm'
import { getAdapter, getAgent, getProfile } from '../agents/registry.js'
import { hashPermissions } from '../agents/profiles/permissions-hash.js'
import { buildFileContext } from '../skills/file-context.js'
import { stripAnsi, stripRichDecorations } from '../agents/ansi.js'
import { parseArtifacts } from '../artifacts/parse-artifact.js'
import { scanArtifactFiles, scanArtifactBundle } from '../artifacts/scan-artifact-files.js'
import { BASE_PROMPT } from '../prompts/base-prompt.js'
import { createJobSuccessNotification, createJobErrorNotification, createJobPausedNotification } from '../notifications/notification-service.js'
import { deliverWebhook } from '../notifications/webhook-service.js'
import { autoExportArtifacts } from '../notifications/auto-export-service.js'

const MAX_CONSECUTIVE_FAILURES = 3

export async function runScheduledJob(job: ScheduledJob): Promise<void> {
  const now = new Date().toISOString()
  const execId = randomUUID()

  db.insert(scheduledJobExecutions).values({
    id: execId,
    jobId: job.id,
    projectId: job.projectId,
    status: 'running',
    scheduledAt: job.nextRunAt ?? now,
    startedAt: now,
    createdAt: now,
  }).run()

  try {
    const result = await executeRun(job)

    const artifactIds = result.artifacts.map(a => a.id)
    db.update(scheduledJobExecutions)
      .set({
        status: 'success',
        runId: result.runId,
        goalId: result.goalId,
        artifactIds: JSON.stringify(artifactIds),
        endedAt: new Date().toISOString(),
        durationMs: result.durationMs,
      })
      .where(eq(scheduledJobExecutions.id, execId))
      .run()

    db.update(scheduledJobs)
      .set({
        lastRunAt: now,
        consecutiveFailures: 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(scheduledJobs.id, job.id))
      .run()

    // Delivery
    const delivery: DeliveryConfig | null = (job as any).delivery ? JSON.parse((job as any).delivery as string) : null
    createJobSuccessNotification(job, { runId: result.runId, artifactIds, executionId: execId })
    if (delivery?.webhookUrl && delivery.onSuccess !== false) {
      void deliverWebhook(delivery.webhookUrl, {
        event: 'job.success', jobId: job.id, jobName: job.name, executionId: execId,
        runId: result.runId, artifactIds, durationMs: result.durationMs, timestamp: new Date().toISOString(),
        projectId: job.projectId,
      }).catch(() => {})
    }
    if (delivery?.autoExport && artifactIds.length > 0) {
      void autoExportArtifacts(job.projectId, job.name, artifactIds, delivery.exportFormat, { jobId: job.id, executionId: execId }).catch(() => {})
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    db.update(scheduledJobExecutions)
      .set({
        status: 'error',
        endedAt: new Date().toISOString(),
        error: message,
      })
      .where(eq(scheduledJobExecutions.id, execId))
      .run()

    const failures = job.consecutiveFailures + 1
    const updates: Record<string, any> = {
      lastRunAt: now,
      consecutiveFailures: failures,
      updatedAt: new Date().toISOString(),
    }
    if (failures >= MAX_CONSECUTIVE_FAILURES) {
      updates.status = 'paused'
    }
    db.update(scheduledJobs).set(updates).where(eq(scheduledJobs.id, job.id)).run()

    // Delivery
    const delivery: DeliveryConfig | null = (job as any).delivery ? JSON.parse((job as any).delivery as string) : null
    createJobErrorNotification(job, { executionId: execId, error: message })
    if (delivery?.webhookUrl && delivery.onFailure !== false) {
      void deliverWebhook(delivery.webhookUrl, {
        event: 'job.error', jobId: job.id, jobName: job.name, executionId: execId,
        error: message, timestamp: new Date().toISOString(),
        projectId: job.projectId,
      }).catch(() => {})
    }
    if (failures >= MAX_CONSECUTIVE_FAILURES) {
      createJobPausedNotification(job)
    }
  }
}

async function executeRun(job: ScheduledJob): Promise<{
  runId: string
  goalId: string
  artifacts: Artifact[]
  durationMs: number
}> {
  const adapter = getAdapter(job.agentId)
  if (!adapter) throw new Error(`Agent ${job.agentId} not available`)

  const agentDesc = getAgent(job.agentId)
  if (!agentDesc?.detected) throw new Error(`Agent ${job.agentId} not detected`)

  // Permission check
  const profile = getProfile(job.agentId)
  const perms = profile?.permissions
  if (perms && job.permissionsHash) {
    const currentHash = hashPermissions(perms)
    if (currentHash !== job.permissionsHash) {
      db.update(scheduledJobs)
        .set({ status: 'needs-reapproval', updatedAt: new Date().toISOString() })
        .where(eq(scheduledJobs.id, job.id))
        .run()
      throw new Error('Agent permissions changed, job needs re-approval')
    }
  }

  const projectId = job.projectId ?? DEFAULT_PROJECT_ID
  const goalId = randomUUID()
  const runId = randomUUID()
  const now = new Date().toISOString()

  const scheduledContext = `\n\n# 定时任务上下文\n\n任务名称：${job.name}\n触发时间：${now}\n`
  const goalWithContext = job.goal + scheduledContext

  // File context
  const fileIds: string[] = job.fileIds ? JSON.parse(job.fileIds as unknown as string) : []
  const fileContext = fileIds.length > 0 ? buildFileContext(fileIds, projectId) : undefined

  // Workspace setup
  const workspaceDir = join('.workspace', 'runs', runId)
  mkdirSync(workspaceDir, { recursive: true })
  mkdirSync(join(workspaceDir, 'artifacts'), { recursive: true })

  const stdoutPath = join(workspaceDir, 'stdout.log')
  const stderrPath = join(workspaceDir, 'stderr.log')
  writeFileSync(stdoutPath, '', 'utf-8')
  writeFileSync(stderrPath, '', 'utf-8')

  const startedAt = Date.now()

  // Save goal
  db.insert(goals).values({
    id: goalId,
    content: goalWithContext,
    skillId: job.skillId,
    projectId,
    createdAt: now,
  }).run()

  // Build system prompt
  const systemParts = [BASE_PROMPT]
  if (fileContext) systemParts.push(fileContext)
  const systemPrompt = systemParts.join('\n\n')

  // Run via adapter directly (bypass HTTP/SSE)
  let fullText = ''
  let stderr = ''
  let exitCode: number | null = null

  const controller = new AbortController()

  for await (const event of adapter.run(
    { goal: goalWithContext, systemPrompt, workspaceDir },
    controller.signal,
  )) {
    if (event.type === 'stdout') {
      const cleaned = stripRichDecorations(stripAnsi(event.text))
      fullText += cleaned
      appendFileSync(stdoutPath, cleaned, 'utf-8')
    } else if (event.type === 'stderr') {
      const cleaned = stripAnsi(event.text)
      stderr += cleaned
      appendFileSync(stderrPath, cleaned, 'utf-8')
    } else if (event.type === 'exit') {
      exitCode = event.code
    }
  }

  const durationMs = Date.now() - startedAt

  // Parse artifacts
  const bundle = scanArtifactBundle(workspaceDir)
  let fileArtifacts: Artifact[]
  if (bundle) {
    fileArtifacts = [{
      id: randomUUID(), type: 'bundle' as const, title: bundle.title,
      content: JSON.stringify(bundle.manifest), source: 'file' as const,
      sourcePath: 'artifacts/', createdAt: new Date().toISOString(),
    }]
  } else {
    const scannedFiles = scanArtifactFiles(workspaceDir)
    fileArtifacts = scannedFiles.map(f => ({
      id: randomUUID(), type: f.type, title: f.title, content: f.content,
      source: 'file' as const, sourcePath: f.relativePath, createdAt: new Date().toISOString(),
    }))
  }

  let inlineArtifacts = parseArtifacts(fullText)
  if (fileArtifacts.length === 0 && inlineArtifacts.length === 0 && fullText.trim()) {
    inlineArtifacts = [{
      id: randomUUID(), type: 'markdown' as const, title: 'Agent Output',
      content: fullText, source: 'fallback' as const, createdAt: new Date().toISOString(),
    }]
  }
  for (const a of inlineArtifacts) {
    if (!a.source) a.source = 'stdout'
  }
  const fileTitles = new Set(fileArtifacts.map(a => a.title))
  const allArtifacts = [...fileArtifacts, ...inlineArtifacts.filter(a => !fileTitles.has(a.title))]

  // Save run
  db.insert(runs).values({
    id: runId,
    goalId,
    skillId: job.skillId,
    model: agentDesc.version ?? 'cli',
    status: allArtifacts.length > 0 ? 'completed' : 'error',
    projectId,
    agentId: job.agentId,
    agentKind: 'cli',
    cwd: workspaceDir,
    exitCode,
    durationMs,
    stdoutPath,
    stderrPath,
    timedOut: 0,
    cancelled: 0,
    approvalRequired: 0,
    approvalGranted: 0,
    permissionsSnapshot: perms ? JSON.stringify(perms) : null,
    permissionsHash: perms ? hashPermissions(perms) : null,
    createdAt: now,
  }).run()

  for (const artifact of allArtifacts) {
    db.insert(artifacts).values({
      id: artifact.id,
      runId,
      goalId,
      type: artifact.type,
      title: artifact.title,
      content: artifact.content,
      source: artifact.source,
      sourcePath: artifact.sourcePath,
      projectId,
      createdAt: artifact.createdAt,
    }).run()
  }

  return { runId, goalId, artifacts: allArtifacts, durationMs }
}
