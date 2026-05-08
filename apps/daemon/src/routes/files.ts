import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { db } from '../storage/db'
import { files } from '../storage/schema'

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
