const EXT_MAP: Record<string, string> = {
  markdown: '.md',
  html: '.html',
  json: '.json',
  mermaid: '.mmd',
  react: '.tsx',
}

const MIME_MAP: Record<string, string> = {
  markdown: 'text/markdown',
  html: 'text/html',
  json: 'application/json',
  mermaid: 'text/plain',
  react: 'text/plain',
}

export function getArtifactExtension(type: string): string {
  return EXT_MAP[type] ?? '.txt'
}

export function getArtifactMimeType(type: string): string {
  return MIME_MAP[type] ?? 'text/plain'
}

export function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100) || 'artifact'
}

export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content)
    return true
  } catch {
    return false
  }
}

export function downloadArtifact(artifact: { type: string; title: string; content: string }): void {
  const ext = getArtifactExtension(artifact.type)
  const mime = getArtifactMimeType(artifact.type)
  const filename = sanitizeFilename(artifact.title) + ext

  const blob = new Blob([artifact.content], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
