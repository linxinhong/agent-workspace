import { randomUUID } from 'node:crypto'
import type { Artifact, ArtifactType } from '@agent-workspace/contracts'

function extractAttr(tag: string, name: string): string | undefined {
  // Match name="value", name='value', name=value (no quotes)
  const re = new RegExp(`${name}=["']([^"']+)["']|${name}=([^\\s>"']+)`, 'i')
  const m = tag.match(re)
  return m?.[1] ?? m?.[2]
}

export function parseArtifacts(text: string): Artifact[] {
  const artifacts: Artifact[] = []

  // Match <artifact ...>...</artifact> with flexible attribute order and quoting
  const openRegex = /<artifact\s+([^>]*?)>/g
  let openMatch

  while ((openMatch = openRegex.exec(text))) {
    const attrs = openMatch[1]
    const afterOpen = openRegex.lastIndex

    const type = extractAttr(attrs, 'type')
    if (!type) continue

    // Find closing tag
    const closeIdx = text.indexOf('</artifact>', afterOpen)
    if (closeIdx === -1) {
      // No closing tag — take rest of text as content (best effort)
      const content = text.slice(afterOpen).trim()
      if (content.length > 0) {
        artifacts.push({
          id: randomUUID(),
          type: type as ArtifactType,
          title: extractAttr(attrs, 'title') ?? 'Untitled',
          content,
          createdAt: new Date().toISOString(),
        })
      }
      break
    }

    const content = text.slice(afterOpen, closeIdx).trim()
    artifacts.push({
      id: randomUUID(),
      type: type as ArtifactType,
      title: extractAttr(attrs, 'title') ?? 'Untitled',
      content,
      createdAt: new Date().toISOString(),
    })

    openRegex.lastIndex = closeIdx + '</artifact>'.length
  }

  return artifacts
}
