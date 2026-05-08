import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '../storage/db'
import { artifacts, goals, runs, messages as messagesTable } from '../storage/schema'
import { loadSkills } from '../skills/skill-loader'
import { runRefine } from '../agent/run-agent'
import type { Artifact } from '@agent-workspace/contracts'

const RefineRequestSchema = z.object({
  instruction: z.string().min(1).max(4000),
  skillId: z.string().min(1).max(100).optional(),
})

export const artifactsRoute = new Hono()

artifactsRoute.get('/api/artifacts', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)

  const rows = db
    .select({
      id: artifacts.id,
      goalId: artifacts.goalId,
      type: artifacts.type,
      title: artifacts.title,
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .orderBy(desc(artifacts.createdAt))
    .limit(limit)
    .all()

  return c.json(rows)
})

artifactsRoute.get('/api/artifacts/:id', async (c) => {
  const id = c.req.param('id')
  const result = db.select().from(artifacts).where(eq(artifacts.id, id)).get()

  if (!result) {
    return c.json({ error: 'Artifact not found' }, 404)
  }

  return c.json(result)
})

artifactsRoute.get('/api/artifacts/:id/versions', async (c) => {
  const id = c.req.param('id')

  const seed = db.select().from(artifacts).where(eq(artifacts.id, id)).get()
  if (!seed) {
    return c.json({ error: 'Artifact not found' }, 404)
  }

  const chain: typeof seed[] = [seed]

  let current = seed
  while (current.parentArtifactId) {
    const parent = db.select().from(artifacts).where(eq(artifacts.id, current.parentArtifactId)).get()
    if (!parent) break
    chain.unshift(parent)
    current = parent
  }

  return c.json(chain)
})

artifactsRoute.post('/api/artifacts/:id/refine', async (c) => {
  const id = c.req.param('id')
  const raw = await c.req.json()
  const parsed = RefineRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, 400)
  }
  const body = parsed.data

  const original = db.select().from(artifacts).where(eq(artifacts.id, id)).get()
  if (!original) {
    return c.json({ error: 'Artifact not found' }, 404)
  }

  const skills = await loadSkills()
  const skill = body.skillId ? skills.find(s => s.id === body.skillId) : undefined
  const model = process.env.PROVIDER_DEFAULT_MODEL ?? 'gpt-4.1'

  const providerConfig = {
    apiKey: process.env.PROVIDER_API_KEY ?? '',
    baseUrl: process.env.PROVIDER_BASE_URL ?? 'https://api.openai.com/v1',
  }

  if (!providerConfig.apiKey) {
    return c.json({ error: 'PROVIDER_API_KEY is not configured' }, 500)
  }

  const runId = randomUUID()
  const now = new Date().toISOString()

  const saveRun = async (data: { goal: { id: string; content: string; createdAt: string }; model: string; skillId?: string; messages: Array<{ role: string; content: string }>; artifacts: Array<{ id: string; type: string; title: string; content: string; parentArtifactId?: string; version?: number; createdAt: string }> }) => {
    db.insert(goals).values({ id: data.goal.id, content: data.goal.content, createdAt: data.goal.createdAt }).run()

    db.insert(runs).values({
      id: runId,
      goalId: data.goal.id,
      skillId: data.skillId,
      model: data.model,
      status: data.artifacts.length > 0 ? 'completed' : 'error',
      createdAt: now,
    }).run()

    for (const msg of data.messages) {
      db.insert(messagesTable).values({ id: randomUUID(), runId, role: msg.role, content: msg.content, createdAt: now }).run()
    }

    for (const artifact of data.artifacts) {
      db.insert(artifacts).values({
        id: artifact.id,
        runId,
        goalId: data.goal.id,
        type: artifact.type,
        title: artifact.title,
        content: artifact.content,
        parentArtifactId: artifact.parentArtifactId,
        version: artifact.version,
        createdAt: artifact.createdAt,
      }).run()
    }
  }

  return streamSSE(c, async (stream) => {
    for await (const event of runRefine({
      originalArtifact: original as unknown as Artifact,
      instruction: body.instruction!,
      skill,
      model,
      providerConfig,
      saveRun,
    })) {
      let data: Record<string, unknown>
      switch (event.type) {
        case 'start':
          data = { goalId: event.goalId }
          break
        case 'delta':
          data = { content: event.content }
          break
        case 'artifact':
          data = { id: event.artifact.id, type: event.artifact.type, title: event.artifact.title }
          break
        case 'error':
          data = { error: event.error }
          break
        case 'done':
          data = { status: 'success' }
          break
      }
      await stream.writeSSE({ event: event.type, data: JSON.stringify(data) })
    }
  })
})
