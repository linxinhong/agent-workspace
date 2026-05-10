import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ArtifactType } from '@agent-workspace/contracts'

const EXT_TYPE_MAP: Record<string, ArtifactType> = {
  md: 'markdown',
  html: 'html',
  htm: 'html',
  json: 'json',
  mmd: 'mermaid',
  tsx: 'react',
  txt: 'markdown',
}

export interface ScannedArtifactFile {
  relativePath: string
  filename: string
  title: string
  type: ArtifactType
  content: string
  size: number
}

export function scanArtifactFiles(workspaceDir: string): ScannedArtifactFile[] {
  const results: ScannedArtifactFile[] = []
  const artifactsDir = join(workspaceDir, 'artifacts')
  try {
    const entries = readdirSync(artifactsDir)
    for (const entry of entries) {
      const filePath = join(artifactsDir, entry)
      const stat = statSync(filePath)
      if (!stat.isFile()) continue
      if (stat.size > 1_000_000) continue

      const ext = entry.split('.').pop()?.toLowerCase() ?? ''
      const type = EXT_TYPE_MAP[ext]
      if (!type) continue

      const content = readFileSync(filePath, 'utf-8')
      const title = entry.replace(/\.[^.]+$/, '')

      results.push({
        relativePath: `artifacts/${entry}`,
        filename: entry,
        title,
        type,
        content,
        size: stat.size,
      })
    }
  } catch { /* best effort */ }
  return results
}
