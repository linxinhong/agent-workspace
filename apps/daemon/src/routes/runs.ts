import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { db } from '../storage/db'
import { runs, goals, messages, artifacts } from '../storage/schema'

export const runsRoute = new Hono()

runsRoute.get('/api/runs', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  const rows = db
    .select({
      id: runs.id,
      goalId: runs.goalId,
      goalContent: goals.content,
      skillId: runs.skillId,
      model: runs.model,
      status: runs.status,
      createdAt: runs.createdAt,
    })
    .from(runs)
    .leftJoin(goals, eq(runs.goalId, goals.id))
    .orderBy(desc(runs.createdAt))
    .limit(limit)
    .all()

  return c.json(rows)
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
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .where(eq(artifacts.runId, id))
    .all()

  return c.json({
    id: run.id,
    goalId: run.goalId,
    goal: goal?.content ?? null,
    skillId: run.skillId,
    model: run.model,
    status: run.status,
    createdAt: run.createdAt,
    messages: runMessages,
    artifacts: runArtifacts,
  })
})
