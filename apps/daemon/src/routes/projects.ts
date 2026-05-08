import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { db } from '../storage/db'
import { projects, artifacts, runs } from '../storage/schema'

export const projectsRoute = new Hono()

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
})

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
})

projectsRoute.get('/api/projects', async (c) => {
  const rows = db.select().from(projects).orderBy(desc(projects.updatedAt)).all()
  return c.json(rows)
})

projectsRoute.post('/api/projects', async (c) => {
  const parsed = CreateProjectSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, 400)
  }

  const now = new Date().toISOString()
  const id = randomUUID()
  const row = { id, name: parsed.data.name, description: parsed.data.description, createdAt: now, updatedAt: now }

  db.insert(projects).values(row).run()
  return c.json(row, 201)
})

projectsRoute.get('/api/projects/:id', async (c) => {
  const id = c.req.param('id')
  const project = db.select().from(projects).where(eq(projects.id, id)).get()
  if (!project) {
    return c.json({ error: 'Project not found' }, 404)
  }

  const artifactCount = db.select({ count: artifacts.id }).from(artifacts).where(eq(artifacts.projectId, id)).all().length
  const runCount = db.select({ count: runs.id }).from(runs).where(eq(runs.projectId, id)).all().length

  return c.json({ ...project, artifactCount, runCount })
})

projectsRoute.patch('/api/projects/:id', async (c) => {
  const id = c.req.param('id')
  const parsed = UpdateProjectSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, 400)
  }

  const existing = db.select().from(projects).where(eq(projects.id, id)).get()
  if (!existing) {
    return c.json({ error: 'Project not found' }, 404)
  }

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { updatedAt: now }
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.description !== undefined) updates.description = parsed.data.description

  db.update(projects).set(updates).where(eq(projects.id, id)).run()
  return c.json({ ...existing, ...updates })
})

projectsRoute.delete('/api/projects/:id', async (c) => {
  const id = c.req.param('id')

  const hasArtifacts = db.select().from(artifacts).where(eq(artifacts.projectId, id)).limit(1).get()
  if (hasArtifacts) {
    return c.json({ error: 'Cannot delete project with artifacts' }, 400)
  }

  const result = db.delete(projects).where(eq(projects.id, id)).run()
  if (result.changes === 0) {
    return c.json({ error: 'Project not found' }, 404)
  }

  return c.json({ ok: true })
})
