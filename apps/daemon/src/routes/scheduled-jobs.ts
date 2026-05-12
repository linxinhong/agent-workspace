import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { CronExpressionParser } from 'cron-parser'
import { db, DEFAULT_PROJECT_ID } from '../storage/db'
import { scheduledJobs, scheduledJobExecutions } from '../storage/schema'
import { computeNextRunAt } from '../scheduler/schedule-calculator.js'
import { runScheduledJob } from '../scheduler/job-runner.js'
import { getAdapter, getAgent, getProfile } from '../agents/registry.js'
import { hashPermissions } from '../agents/profiles/permissions-hash.js'
import type { ScheduledJob, ScheduledJobExecution } from '@agent-workspace/contracts'

const CreateJobSchema = z.object({
  projectId: z.string().max(200).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  scheduleType: z.enum(['once', 'interval', 'cron']),
  runAt: z.string().optional(),
  intervalSeconds: z.number().int().min(1).optional(),
  cron: z.string().max(100).optional(),
  goal: z.string().min(1).max(8000),
  agentId: z.string().min(1).max(200),
  skillId: z.string().max(100).optional(),
  fileIds: z.array(z.string().max(200)).max(10).optional(),
  delivery: z.object({
    webhookUrl: z.string().max(500).optional(),
    onSuccess: z.boolean().optional(),
    onFailure: z.boolean().optional(),
    autoExport: z.boolean().optional(),
    exportFormat: z.enum(['markdown', 'html']).optional(),
  }).optional(),
  approval: z.object({
    approved: z.boolean(),
    permissionsHash: z.string(),
  }).optional(),
})

const PatchJobSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  goal: z.string().min(1).max(8000).optional(),
  scheduleType: z.enum(['once', 'interval', 'cron']).optional(),
  runAt: z.string().optional(),
  intervalSeconds: z.number().int().min(1).optional(),
  cron: z.string().max(100).optional(),
  fileIds: z.array(z.string().max(200)).max(10).optional(),
  delivery: z.object({
    webhookUrl: z.string().max(500).optional(),
    onSuccess: z.boolean().optional(),
    onFailure: z.boolean().optional(),
    autoExport: z.boolean().optional(),
    exportFormat: z.enum(['markdown', 'html']).optional(),
  }).optional(),
})

export const scheduledJobsRoute = new Hono()

scheduledJobsRoute.get('/api/scheduled-jobs', async (c) => {
  const projectId = c.req.query('projectId') ?? DEFAULT_PROJECT_ID
  const rows = db.select().from(scheduledJobs)
    .where(eq(scheduledJobs.projectId, projectId))
    .orderBy(desc(scheduledJobs.createdAt))
    .all()
  return c.json(rows.map(rowToJob))
})

scheduledJobsRoute.post('/api/scheduled-jobs', async (c) => {
  const raw = await c.req.json()
  const parsed = CreateJobSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, 400)
  }
  const body = parsed.data
  const projectId = body.projectId ?? DEFAULT_PROJECT_ID

  // Validate agent
  const agentDesc = getAgent(body.agentId)
  if (!agentDesc?.detected) {
    return c.json({ error: `Agent "${body.agentId}" is not available` }, 400)
  }

  // Permission snapshot
  const profile = getProfile(body.agentId)
  const perms = profile?.permissions
  const requiresApproval = perms?.requiresApproval ?? false
  if (requiresApproval && !body.approval?.approved) {
    return c.json({ error: 'This agent requires approval', requiresApproval: true, permissions: perms }, 403)
  }

  const now = new Date().toISOString()
  const id = randomUUID()

  const job = {
    id,
    projectId,
    name: body.name,
    description: body.description ?? null,
    status: 'enabled' as const,
    scheduleType: body.scheduleType,
    runAt: body.runAt ?? null,
    intervalSeconds: body.intervalSeconds ?? null,
    cron: body.cron ?? null,
    goal: body.goal,
    agentId: body.agentId,
    skillId: body.skillId ?? null,
    fileIds: body.fileIds ? JSON.stringify(body.fileIds) : null,
    delivery: body.delivery ? JSON.stringify(body.delivery) : null,
    outputMode: 'new-artifact',
    permissionsSnapshot: perms ? JSON.stringify(perms) : null,
    permissionsHash: perms ? hashPermissions(perms) : null,
    consecutiveFailures: 0,
    nextRunAt: null as string | null,
    lastRunAt: null as string | null,
    createdAt: now,
    updatedAt: now,
  }

  // Compute nextRunAt
  const nextRun = computeNextRunAt(rowToJob(job) as ScheduledJob, new Date())
  job.nextRunAt = nextRun?.toISOString() ?? null

  if (!job.nextRunAt && body.scheduleType === 'once') {
    return c.json({ error: 'once job runAt is in the past' }, 400)
  }

  db.insert(scheduledJobs).values(job).run()

  return c.json(rowToJob(db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()!))
})

scheduledJobsRoute.get('/api/scheduled-jobs/:id', async (c) => {
  const id = c.req.param('id')
  const row = db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()
  if (!row) return c.json({ error: 'Job not found' }, 404)
  return c.json(rowToJob(row))
})

scheduledJobsRoute.patch('/api/scheduled-jobs/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()
  if (!existing) return c.json({ error: 'Job not found' }, 404)

  const raw = await c.req.json()
  const parsed = PatchJobSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, 400)
  }
  const body = parsed.data
  const now = new Date().toISOString()

  const updates: Record<string, any> = { updatedAt: now }
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.goal !== undefined) updates.goal = body.goal
  if (body.scheduleType !== undefined) updates.scheduleType = body.scheduleType
  if (body.runAt !== undefined) updates.runAt = body.runAt
  if (body.intervalSeconds !== undefined) updates.intervalSeconds = body.intervalSeconds
  if (body.cron !== undefined) updates.cron = body.cron
  if (body.fileIds !== undefined) updates.fileIds = JSON.stringify(body.fileIds)
  if (body.delivery !== undefined) updates.delivery = body.delivery ? JSON.stringify(body.delivery) : null

  // Recalculate nextRunAt if schedule changed
  if (body.scheduleType || body.runAt || body.intervalSeconds || body.cron) {
    const merged = rowToJob({ ...existing, ...updates }) as ScheduledJob
    const next = computeNextRunAt(merged, new Date())
    updates.nextRunAt = next?.toISOString() ?? null
  }

  db.update(scheduledJobs).set(updates).where(eq(scheduledJobs.id, id)).run()
  return c.json(rowToJob(db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()!))
})

scheduledJobsRoute.delete('/api/scheduled-jobs/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()
  if (!existing) return c.json({ error: 'Job not found' }, 404)

  db.delete(scheduledJobExecutions).where(eq(scheduledJobExecutions.jobId, id)).run()
  db.delete(scheduledJobs).where(eq(scheduledJobs.id, id)).run()
  return c.json({ ok: true })
})

scheduledJobsRoute.post('/api/scheduled-jobs/:id/enable', async (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()
  if (!existing) return c.json({ error: 'Job not found' }, 404)

  const now = new Date().toISOString()
  const next = computeNextRunAt(rowToJob(existing) as ScheduledJob, new Date())

  db.update(scheduledJobs)
    .set({ status: 'enabled', nextRunAt: next?.toISOString() ?? null, updatedAt: now })
    .where(eq(scheduledJobs.id, id))
    .run()

  return c.json(rowToJob(db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()!))
})

scheduledJobsRoute.post('/api/scheduled-jobs/:id/disable', async (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()
  if (!existing) return c.json({ error: 'Job not found' }, 404)

  db.update(scheduledJobs)
    .set({ status: 'disabled', updatedAt: new Date().toISOString() })
    .where(eq(scheduledJobs.id, id))
    .run()

  return c.json(rowToJob(db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()!))
})

scheduledJobsRoute.post('/api/scheduled-jobs/:id/run-now', async (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()
  if (!existing) return c.json({ error: 'Job not found' }, 404)

  const job = rowToJob(existing)

  // Run asynchronously, return immediately
  void runScheduledJob(job).catch(() => {})

  return c.json({ ok: true, message: 'Job triggered' })
})

scheduledJobsRoute.get('/api/scheduled-jobs/:id/executions', async (c) => {
  const id = c.req.param('id')
  const rows = db.select().from(scheduledJobExecutions)
    .where(eq(scheduledJobExecutions.jobId, id))
    .orderBy(desc(scheduledJobExecutions.createdAt))
    .limit(50)
    .all()

  return c.json(rows.map(rowToExecution))
})

// Scheduler status
scheduledJobsRoute.get('/api/scheduler/status', async (c) => {
  const { scheduler } = await import('../server.js')
  return c.json(scheduler.getStatus())
})

// Validate cron expression
scheduledJobsRoute.post('/api/scheduler/validate-cron', async (c) => {
  const body = await c.req.json<{ cron?: string }>()
  if (!body.cron) {
    return c.json({ valid: false, error: 'cron expression is required' }, 400)
  }
  try {
    const interval = CronExpressionParser.parse(body.cron, { currentDate: new Date() })
    const nextRuns: string[] = []
    for (let i = 0; i < 5; i++) {
      nextRuns.push(interval.next().toDate().toISOString())
    }
    return c.json({ valid: true, nextRuns })
  } catch (err) {
    return c.json({ valid: false, error: err instanceof Error ? err.message : 'Invalid cron expression' })
  }
})

// Reapprove job after permission change
scheduledJobsRoute.post('/api/scheduled-jobs/:id/reapprove', async (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()
  if (!existing) return c.json({ error: 'Job not found' }, 404)

  const body = await c.req.json<{ approval?: { approved: boolean; permissionsHash: string } }>()
  if (!body.approval?.approved || !body.approval.permissionsHash) {
    return c.json({ error: 'Approval with permissionsHash required' }, 400)
  }

  const profile = getProfile(existing.agentId)
  const currentHash = profile?.permissions ? hashPermissions(profile.permissions) : null
  if (body.approval.permissionsHash !== currentHash) {
    return c.json({ error: 'permissionsHash does not match current agent profile' }, 400)
  }

  const now = new Date().toISOString()
  const next = computeNextRunAt(rowToJob(existing) as ScheduledJob, new Date())

  db.update(scheduledJobs)
    .set({
      status: 'enabled',
      permissionsSnapshot: profile?.permissions ? JSON.stringify(profile.permissions) : null,
      permissionsHash: currentHash,
      nextRunAt: next?.toISOString() ?? null,
      updatedAt: now,
    })
    .where(eq(scheduledJobs.id, id))
    .run()

  return c.json(rowToJob(db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get()!))
})

function rowToJob(row: any): ScheduledJob {
  return {
    ...row,
    fileIds: row.fileIds ? JSON.parse(row.fileIds) : undefined,
    delivery: row.delivery ?? undefined,
  } as unknown as ScheduledJob
}

function rowToExecution(row: any): ScheduledJobExecution {
  return {
    ...row,
    artifactIds: row.artifactIds ? JSON.parse(row.artifactIds) : undefined,
  }
}
