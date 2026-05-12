import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { db } from '../storage/db'
import { files, artifacts } from '../storage/schema'

const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.json', '.csv', '.html', '.xml', '.log', '.yaml', '.yml', '.toml', '.env', '.ini', '.conf', '.sh', '.js', '.ts', '.py', '.sql'])
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_CONTENT_TEXT = 500_000 // 500KB text

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}

function getExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function ensureProjectDir(projectId: string): string {
  const dir = resolve(`.workspace/projects/${projectId}/files`)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export const filesRoute = new Hono()

filesRoute.post('/api/projects/:projectId/files', async (c) => {
  const projectId = c.req.param('projectId')
  const body = await c.req.parseBody()
  const uploaded = body['file']

  if (!uploaded || !(uploaded instanceof File)) {
    return c.json({ error: 'file is required' }, 400)
  }

  const name = sanitizeFilename(uploaded.name)
  const ext = getExt(name)

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return c.json({ error: `File type ${ext} not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}` }, 400)
  }

  if (uploaded.size > MAX_FILE_SIZE) {
    return c.json({ error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB` }, 400)
  }

  const buffer = Buffer.from(await uploaded.arrayBuffer())
  const id = randomUUID()
  const now = new Date().toISOString()
  const storedName = `${id}-${name}`

  const dir = ensureProjectDir(projectId)
  const filePath = join(dir, storedName)

  // Prevent path traversal
  if (!filePath.startsWith(dir)) {
    return c.json({ error: 'Invalid file path' }, 400)
  }

  writeFileSync(filePath, buffer)

  let contentText: string | null = null
  try {
    const text = buffer.toString('utf-8')
    if (text.length <= MAX_CONTENT_TEXT) {
      contentText = text
    }
  } catch {
    // Binary file, skip text extraction
  }

  const row = {
    id,
    projectId,
    name,
    path: filePath,
    mimeType: uploaded.type || null,
    size: buffer.length,
    contentText,
    createdAt: now,
    updatedAt: now,
  }

  db.insert(files).values(row).run()

  return c.json({ id, projectId, name, mimeType: row.mimeType, size: row.size, createdAt: now }, 201)
})

filesRoute.get('/api/projects/:projectId/files', async (c) => {
  const projectId = c.req.param('projectId')
  const rows = db
    .select({
      id: files.id,
      projectId: files.projectId,
      name: files.name,
      mimeType: files.mimeType,
      size: files.size,
      source: files.source,
      artifactId: files.artifactId,
      createdAt: files.createdAt,
      updatedAt: files.updatedAt,
    })
    .from(files)
    .where(eq(files.projectId, projectId))
    .orderBy(desc(files.createdAt))
    .all()

  return c.json(rows)
})

filesRoute.get('/api/files/:id', async (c) => {
  const id = c.req.param('id')
  const row = db.select().from(files).where(eq(files.id, id)).get()
  if (!row) return c.json({ error: 'File not found' }, 404)
  return c.json(row)
})

filesRoute.delete('/api/files/:id', async (c) => {
  const id = c.req.param('id')
  const row = db.select().from(files).where(eq(files.id, id)).get()
  if (!row) return c.json({ error: 'File not found' }, 404)

  try { unlinkSync(row.path) } catch { /* file already gone */ }
  db.delete(files).where(eq(files.id, id)).run()
  return c.json({ ok: true })
})

const EXT_MAP: Record<string, string> = {
  markdown: '.md', html: '.html', json: '.json', mermaid: '.mmd', react: '.tsx',
}

const MIME_MAP: Record<string, string> = {
  markdown: 'text/markdown', html: 'text/html', json: 'application/json', mermaid: 'text/plain', react: 'text/plain',
}

const ApplyRequestSchema = z.object({
  projectId: z.string().min(1),
  strategy: z.enum(['rename', 'overwrite']).default('rename'),
})

function resolveConflictName(projectId: string, name: string): string {
  let candidate = name
  let i = 1
  const ext = getExt(name)
  const base = ext ? name.slice(0, -ext.length) : name
  while (db.select({ id: files.id }).from(files).where(eq(files.name, candidate)).get()) {
    candidate = `${base} (${i})${ext}`
    i++
  }
  return candidate
}

function writeProjectFile(
  projectId: string,
  name: string,
  content: string,
  source: 'artifact' | 'bundle',
  artifactId: string,
  strategy: 'rename' | 'overwrite',
): typeof files.$inferSelect {
  const dir = ensureProjectDir(projectId)
  const now = new Date().toISOString()

  const existing = db.select().from(files).where(eq(files.name, name)).get()
  if (existing) {
    if (strategy === 'overwrite') {
      try { unlinkSync(existing.path) } catch { /* ignore */ }
      db.delete(files).where(eq(files.id, existing.id)).run()
    } else {
      name = resolveConflictName(projectId, name)
    }
  }

  const id = randomUUID()
  const buffer = Buffer.from(content, 'utf-8')
  const storedName = `${id}-${name}`
  const filePath = join(dir, storedName)
  if (!filePath.startsWith(dir)) throw new Error('Invalid path')

  writeFileSync(filePath, buffer)

  const row = {
    id,
    projectId,
    name,
    path: filePath,
    mimeType: MIME_MAP[source === 'bundle' ? 'text/plain' : 'text/plain'] || 'text/plain',
    size: buffer.length,
    contentText: content.length <= MAX_CONTENT_TEXT ? content : null,
    source,
    artifactId,
    createdAt: now,
    updatedAt: now,
  }

  db.insert(files).values(row).run()
  return db.select().from(files).where(eq(files.id, id)).get()!
}

filesRoute.post('/api/artifacts/:id/apply', async (c) => {
  const artifactId = c.req.param('id')
  const raw = await c.req.json()
  const parsed = ApplyRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, 400)
  }
  const { projectId, strategy } = parsed.data

  const artifact = db.select().from(artifacts).where(eq(artifacts.id, artifactId)).get()
  if (!artifact) return c.json({ error: 'Artifact not found' }, 404)

  if (artifact.type === 'bundle') {
    let manifest: { entry?: string; files: Array<{ path: string; content: string }> }
    try { manifest = JSON.parse(artifact.content) } catch { return c.json({ error: 'Invalid bundle manifest' }, 500) }

    const results = manifest.files.map(f =>
      writeProjectFile(projectId, f.path.split('/').pop()!, f.content, 'bundle', artifactId, strategy)
    )
    return c.json(results, 201)
  }

  const ext = EXT_MAP[artifact.type] ?? '.txt'
  const name = (artifact.title ?? 'artifact').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, '_').slice(0, 100) + ext
  const result = writeProjectFile(projectId, name, artifact.content, 'artifact', artifactId, strategy)
  return c.json(result, 201)
})
