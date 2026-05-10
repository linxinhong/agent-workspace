import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { db } from '../storage/db'
import { runs, goals, messages, artifacts } from '../storage/schema'
import { cancelActiveRun } from '../agents/active-runs.js'

const MATERIAL_FILE_MAP: Record<string, string> = {
  'PROMPT.md': 'prompt',
  'SKILL.md': 'skill',
  'FILE_CONTEXT.md': 'file-context',
  'TEMPLATE.md': 'template',
  'stdout.log': 'stdout',
  'stderr.log': 'stderr',
  'result.json': 'result',
}

export const runsRoute = new Hono()

runsRoute.get('/api/runs', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)
  const projectId = c.req.query('projectId')

  let query = db
    .select({
      id: runs.id,
      goalId: runs.goalId,
      goalContent: goals.content,
      skillId: runs.skillId,
      model: runs.model,
      status: runs.status,
      projectId: runs.projectId,
      createdAt: runs.createdAt,
    })
    .from(runs)
    .leftJoin(goals, eq(runs.goalId, goals.id))
    .orderBy(desc(runs.createdAt))
    .limit(limit)

  if (projectId) {
    query = query.where(eq(runs.projectId, projectId)) as typeof query
  }

  return c.json(query.all())
})

runsRoute.get('/api/runs/:id', async (c) => {
  const id = c.req.param('id')

  const run = db.select().from(runs).where(eq(runs.id, id)).get()
  if (!run) {
    return c.json({ error: 'Run not found' }, 404)
  }

  const goal = db.select().from(goals).where(eq(goals.id, run.goalId)).get()
  const runMessages = db.select().from(messages).where(eq(messages.runId, id)).all()
  const runArtifacts = db
    .select({
      id: artifacts.id,
      type: artifacts.type,
      title: artifacts.title,
      source: artifacts.source,
      sourcePath: artifacts.sourcePath,
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .where(eq(artifacts.runId, id))
    .all()

  // Build materialized files list from cwd (including artifacts/ subdirectory)
  let materializedFiles: Array<{ name: string; size: number; kind: string }> = []
  if (run.cwd) {
    try {
      const entries = readdirSync(run.cwd)
      for (const entry of entries) {
        const filePath = join(run.cwd!, entry)
        const stat = statSync(filePath)
        if (stat.isFile()) {
          materializedFiles.push({
            name: entry,
            size: stat.size,
            kind: MATERIAL_FILE_MAP[entry] ?? 'other',
          })
        } else if (stat.isDirectory() && entry === 'artifacts') {
          const artEntries = readdirSync(filePath)
          for (const artEntry of artEntries) {
            const artPath = join(filePath, artEntry)
            const artStat = statSync(artPath)
            if (!artStat.isFile()) continue
            materializedFiles.push({
              name: `artifacts/${artEntry}`,
              size: artStat.size,
              kind: 'artifact',
            })
          }
        }
      }
    } catch { /* best effort */ }
  }

  // Read previews
  let stdoutPreview: string | undefined
  let stderrPreview: string | undefined
  if (run.stdoutPath) {
    try { stdoutPreview = readFileSync(run.stdoutPath, 'utf-8').slice(0, 2000) } catch { /* ignore */ }
  }
  if (run.stderrPath) {
    try { stderrPreview = readFileSync(run.stderrPath, 'utf-8').slice(0, 500) } catch { /* ignore */ }
  }

  return c.json({
    id: run.id,
    goalId: run.goalId,
    goal: goal?.content ?? null,
    skillId: run.skillId,
    model: run.model,
    status: run.status,
    projectId: run.projectId,
    createdAt: run.createdAt,
    messages: runMessages,
    artifacts: runArtifacts,
    agentId: run.agentId,
    agentKind: run.agentKind,
    command: run.command,
    cwd: run.cwd,
    exitCode: run.exitCode,
    durationMs: run.durationMs,
    timedOut: run.timedOut,
    cancelled: run.cancelled,
    stdoutPath: run.stdoutPath,
    stderrPath: run.stderrPath,
    stdoutPreview,
    stderrPreview,
    materializedFiles,
  })
})

runsRoute.get('/api/runs/:id/files/:name', async (c) => {
  const id = c.req.param('id')
  const name = c.req.param('name')

  const run = db.select({ cwd: runs.cwd }).from(runs).where(eq(runs.id, id)).get()
  if (!run?.cwd) {
    return c.json({ error: 'Run not found or no workspace' }, 404)
  }

  const filePath = resolve(run.cwd, name)
  const rel = relative(run.cwd, filePath)
  if (rel.startsWith('..') || rel === '') {
    return c.json({ error: 'Invalid file path' }, 400)
  }

  try {
    const stat = statSync(filePath)
    if (!stat.isFile()) {
      return c.json({ error: 'Not a file' }, 400)
    }
    const content = readFileSync(filePath, 'utf-8')
    return c.text(content)
  } catch {
    return c.json({ error: 'File not found' }, 404)
  }
})

runsRoute.post('/api/runs/:id/cancel', async (c) => {
  const id = c.req.param('id')

  const run = db.select({ status: runs.status }).from(runs).where(eq(runs.id, id)).get()
  if (!run) {
    return c.json({ error: 'Run not found' }, 404)
  }

  const cancelled = cancelActiveRun(id)
  if (!cancelled) {
    return c.json({ error: 'Run is not active' }, 400)
  }

  // Update DB
  db.update(runs)
    .set({ status: 'cancelled', cancelled: 1 })
    .where(eq(runs.id, id))
    .run()

  return c.json({ success: true })
})
