import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { ArtifactType, ArtifactBundleManifest } from '@agent-workspace/contracts'

const EXT_TYPE_MAP: Record<string, ArtifactType> = {
  md: 'markdown',
  html: 'html',
  htm: 'html',
  json: 'json',
  mmd: 'mermaid',
  tsx: 'react',
  txt: 'markdown',
}

const BUNDLE_EXT_MAP: Record<string, ArtifactType | string> = {
  ...EXT_TYPE_MAP,
  css: 'css',
  js: 'javascript',
  ts: 'typescript',
  svg: 'svg',
}

export interface ScannedArtifactFile {
  relativePath: string
  filename: string
  title: string
  type: ArtifactType
  content: string
  size: number
}

function scanRecursive(dir: string, base: string, extMap: Record<string, string>): ScannedArtifactFile[] {
  const results: ScannedArtifactFile[] = []
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return results }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...scanRecursive(fullPath, base, extMap))
      continue
    }
    if (!stat.isFile()) continue
    if (stat.size > 1_000_000) continue

    const ext = entry.split('.').pop()?.toLowerCase() ?? ''
    const type = extMap[ext]
    if (!type) continue

    const content = readFileSync(fullPath, 'utf-8')
    const relPath = relative(base, fullPath)
    const title = entry.replace(/\.[^.]+$/, '')

    results.push({
      relativePath: `artifacts/${relPath}`,
      filename: entry,
      title,
      type: type as ArtifactType,
      content,
      size: stat.size,
    })
  }
  return results
}

export function scanArtifactFiles(workspaceDir: string): ScannedArtifactFile[] {
  return scanRecursive(join(workspaceDir, 'artifacts'), workspaceDir, EXT_TYPE_MAP)
}

export interface ScannedBundle {
  manifest: ArtifactBundleManifest
  title: string
  totalSize: number
}

const ENTRY_PRIORITY = ['index.html', 'README.md', 'readme.md']

export function scanArtifactBundle(workspaceDir: string): ScannedBundle | null {
  const files = scanRecursive(join(workspaceDir, 'artifacts'), workspaceDir, BUNDLE_EXT_MAP)
  if (files.length < 2) return null

  const entry = files.find(f => ENTRY_PRIORITY.includes(f.filename))
  const title = entry?.title ?? files[0].title

  const manifest: ArtifactBundleManifest = {
    entry: entry?.relativePath.replace('artifacts/', ''),
    files: files.map(f => ({
      path: f.relativePath.replace('artifacts/', ''),
      type: f.type,
      size: f.size,
      content: f.content,
    })),
  }

  return {
    manifest,
    title,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
  }
}
