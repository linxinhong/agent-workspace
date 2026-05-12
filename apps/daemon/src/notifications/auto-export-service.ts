import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '../storage/db'
import { artifacts } from '../storage/schema'
import { eq } from 'drizzle-orm'
import { createNotification } from './notification-service.js'
import { recordDeliveryAttempt } from './webhook-service.js'
import type { Artifact } from '@agent-workspace/contracts'

const EXPORT_EXT: Record<string, string> = {
  markdown: '.md',
  html: '.html',
  json: '.json',
  mermaid: '.mmd',
  react: '.tsx',
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'export'
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100) || 'untitled'
}

export async function autoExportArtifacts(
  projectId: string,
  jobName: string,
  artifactIds: string[],
  format: 'markdown' | 'html' = 'markdown',
  context?: { jobId?: string; executionId?: string },
): Promise<string[]> {
  if (artifactIds.length === 0) return []

  const slug = slugify(jobName)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const exportDir = join('.workspace', 'projects', projectId, 'exports', slug, timestamp)
  mkdirSync(exportDir, { recursive: true })

  const writtenPaths: string[] = []

  for (const id of artifactIds) {
    const row = db.select().from(artifacts).where(eq(artifacts.id, id)).get()
    if (!row) continue

    const artifact = row as unknown as Artifact

    if (artifact.type === 'bundle') {
      // Bundle: parse manifest and write each file
      try {
        const manifest = JSON.parse(artifact.content) as Record<string, string>
        for (const [filename, content] of Object.entries(manifest)) {
          if (typeof content !== 'string') continue
          const filePath = join(exportDir, sanitizeFilename(filename))
          writeFileSync(filePath, content, 'utf-8')
          writtenPaths.push(filePath)
        }
      } catch {
        // If manifest parsing fails, write raw content
        const filename = sanitizeFilename(artifact.title ?? 'bundle') + '.json'
        const filePath = join(exportDir, filename)
        writeFileSync(filePath, artifact.content, 'utf-8')
        writtenPaths.push(filePath)
      }
    } else {
      const ext = EXPORT_EXT[format] ?? EXPORT_EXT[artifact.type] ?? '.txt'
      const filename = sanitizeFilename(artifact.title ?? 'artifact') + ext
      let content = artifact.content

      // Wrap in HTML if exporting as HTML and content is not already HTML
      if (format === 'html' && artifact.type !== 'html') {
        content = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${artifact.title ?? 'Artifact'}</title></head>
<body><pre>${escapeHtml(content)}</pre></body></html>`
      }

      const filePath = join(exportDir, filename)
      writeFileSync(filePath, content, 'utf-8')
      writtenPaths.push(filePath)
    }
  }

  if (writtenPaths.length > 0) {
    recordDeliveryAttempt({
      projectId, jobId: context?.jobId, executionId: context?.executionId,
      type: 'auto-export', status: 'success', target: exportDir,
    })
    createNotification({
      projectId,
      type: 'export.complete',
      title: `${jobName} 产物已导出`,
      message: `导出 ${writtenPaths.length} 个文件到 exports/${slug}/`,
      metadata: { exportDir, jobName, fileCount: writtenPaths.length },
    })
  } else if (artifactIds.length > 0) {
    recordDeliveryAttempt({
      projectId, jobId: context?.jobId, executionId: context?.executionId,
      type: 'auto-export', status: 'error', target: exportDir, error: 'no_files_written',
    })
  }

  return writtenPaths
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
