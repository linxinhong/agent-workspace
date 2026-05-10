import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { z } from 'zod'
import { db } from '../storage/db'
import { artifacts, goals, runs, messages as messagesTable } from '../storage/schema'
import { loadSkills } from '../skills/skill-loader'
import { buildFileContext } from '../skills/file-context'
import { runRefine, runInlineEdit } from '../agent/run-agent'
import type { Artifact } from '@agent-workspace/contracts'

const RefineRequestSchema = z.object({
  instruction: z.string().min(1).max(4000),
  skillId: z.string().min(1).max(100).optional(),
  fileIds: z.array(z.string().max(200)).max(10).optional(),
})

const InlineEditRequestSchema = z.object({
  selectedText: z.string().min(1).max(50000),
  instruction: z.string().min(1).max(2000),
  beforeContext: z.string().max(5000).optional(),
  afterContext: z.string().max(5000).optional(),
})

export const artifactsRoute = new Hono()

artifactsRoute.get('/api/artifacts', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)
  const projectId = c.req.query('projectId')

  let query = db
    .select({
      id: artifacts.id,
      goalId: artifacts.goalId,
      type: artifacts.type,
      title: artifacts.title,
      projectId: artifacts.projectId,
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .orderBy(desc(artifacts.createdAt))
    .limit(limit)

  if (projectId) {
    query = query.where(eq(artifacts.projectId, projectId)) as typeof query
  }

  return c.json(query.all())
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

const EXPORT_EXT: Record<string, string> = {
  markdown: '.md', html: '.html', json: '.json', mermaid: '.mmd', react: '.tsx',
}
const EXPORT_MIME: Record<string, string> = {
  markdown: 'text/markdown', html: 'text/html', json: 'application/json', mermaid: 'text/plain', react: 'text/plain',
}
const SANITIZE_RE = /[<>:"/\\|?*\x00-\x1f]/g

artifactsRoute.get('/api/artifacts/:id/export', async (c) => {
  const id = c.req.param('id')
  const format = c.req.query('format')
  const artifact = db.select().from(artifacts).where(eq(artifacts.id, id)).get()
  if (!artifact) return c.json({ error: 'Artifact not found' }, 404)

  // Bundle zip export
  if (artifact.type === 'bundle' && format === 'zip') {
    let manifest: { entry?: string; files: Array<{ path: string; content: string }> }
    try { manifest = JSON.parse(artifact.content) } catch { return c.json({ error: 'Invalid bundle manifest' }, 500) }

    const filename = (artifact.title ?? 'bundle').replace(SANITIZE_RE, '').replace(/\s+/g, '_').slice(0, 100) || 'bundle'
    const { ZipArchive } = await import('archiver') as unknown as {
      ZipArchive: new (options: { zlib?: { level: number } }) => NodeJS.ReadWriteStream & {
        append: (source: NodeJS.ReadableStream, data: { name: string }) => void
        finalize: () => void
      }
    }
    const archive = new ZipArchive({ zlib: { level: 6 } })
    for (const f of manifest.files) {
      archive.append(Readable.from([f.content]), { name: f.path })
    }
    archive.finalize()

    return new Response(archive as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}.zip"`,
      },
    })
  }

  const ext = EXPORT_EXT[artifact.type] ?? '.txt'
  const mime = EXPORT_MIME[artifact.type] ?? 'text/plain'
  const filename = (artifact.title ?? 'artifact').replace(SANITIZE_RE, '').replace(/\s+/g, '_').slice(0, 100) || 'artifact'
  const full = filename + ext

  return c.body(artifact.content, 200, {
    'Content-Type': mime + '; charset=utf-8',
    'Content-Disposition': `attachment; filename="${full}"`,
  })
})

const CreateVersionSchema = z.object({
  content: z.string().min(1),
  title: z.string().min(1).max(500).optional(),
  changeNote: z.string().max(1000).optional(),
  source: z.string().max(50).optional(),
})

artifactsRoute.post('/api/artifacts/:id/versions', async (c) => {
  const id = c.req.param('id')
  const raw = await c.req.json()
  const parsed = CreateVersionSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, 400)
  }
  const body = parsed.data

  const original = db.select().from(artifacts).where(eq(artifacts.id, id)).get()
  if (!original) return c.json({ error: 'Artifact not found' }, 404)

  // Count existing versions in chain
  let versionCount = 1
  let cur = original
  while (cur.parentArtifactId) {
    const parent = db.select().from(artifacts).where(eq(artifacts.id, cur.parentArtifactId)).get()
    if (!parent) break
    versionCount++
    cur = parent
  }

  const newId = randomUUID()
  const now = new Date().toISOString()
  const newVersion = versionCount + 1

  db.insert(artifacts).values({
    id: newId,
    runId: original.runId,
    goalId: original.goalId,
    type: original.type,
    title: body.title ?? original.title,
    content: body.content,
    parentArtifactId: id,
    version: newVersion,
    changeNote: body.changeNote,
    source: body.source,
    projectId: original.projectId,
    createdAt: now,
  }).run()

  const result = db.select().from(artifacts).where(eq(artifacts.id, newId)).get()
  return c.json(result, 201)
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
    db.insert(goals).values({ id: data.goal.id, content: data.goal.content, projectId: original.projectId, createdAt: data.goal.createdAt }).run()

    db.insert(runs).values({
      id: runId,
      goalId: data.goal.id,
      skillId: data.skillId,
      model: data.model,
      status: data.artifacts.length > 0 ? 'completed' : 'error',
      projectId: original.projectId,
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
        source: 'refine',
        projectId: original.projectId,
        createdAt: artifact.createdAt,
      }).run()    }
  }

  // Load file context if fileIds provided
  const fileContext = (body.fileIds && body.fileIds.length > 0)
    ? buildFileContext(body.fileIds, original.projectId ?? '')
    : undefined

  return streamSSE(c, async (stream) => {
    for await (const event of runRefine({
      originalArtifact: original as unknown as Artifact,
      instruction: body.instruction!,
      skill,
      model,
      providerConfig,
      saveRun,
      fileContext,
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

artifactsRoute.post('/api/artifacts/:id/inline-edit', async (c) => {
  const id = c.req.param('id')
  const raw = await c.req.json()
  const parsed = InlineEditRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, 400)
  }
  const body = parsed.data

  const artifact = db.select().from(artifacts).where(eq(artifacts.id, id)).get()
  if (!artifact) {
    return c.json({ error: 'Artifact not found' }, 404)
  }

  const providerConfig = {
    apiKey: process.env.PROVIDER_API_KEY ?? '',
    baseUrl: process.env.PROVIDER_BASE_URL ?? 'https://api.openai.com/v1',
  }

  if (!providerConfig.apiKey) {
    return c.json({ error: 'PROVIDER_API_KEY is not configured' }, 500)
  }

  const model = process.env.PROVIDER_DEFAULT_MODEL ?? 'gpt-4.1'

  try {
    const result = await runInlineEdit({
      artifactType: artifact.type,
      selectedText: body.selectedText,
      instruction: body.instruction,
      beforeContext: body.beforeContext,
      afterContext: body.afterContext,
      model,
      providerConfig,
    })
    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Inline edit failed'
    return c.json({ error: message }, 500)
  }
})
