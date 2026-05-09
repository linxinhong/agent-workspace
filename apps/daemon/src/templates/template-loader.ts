import { readdir, readFile } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import type { ArtifactTemplate, TemplateVariable, ArtifactType } from '@agent-workspace/contracts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const PROJECT_ROOT = resolve(__dirname, '../../../../')

let cached: ArtifactTemplate[] | null = null

export async function loadTemplates(basePath?: string): Promise<ArtifactTemplate[]> {
  if (cached) return cached

  const templatesDir = basePath ?? join(PROJECT_ROOT, 'templates')
  let entries: Dirent[]
  try {
    entries = await readdir(templatesDir, { withFileTypes: true })
  } catch {
    return []
  }

  const templates: ArtifactTemplate[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const subDir = join(templatesDir, entry.name)
    let subEntries: Dirent[]
    try {
      subEntries = await readdir(subDir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const file of subEntries) {
      if (!file.isFile()) continue
      if (!file.name.endsWith('.md') && !file.name.endsWith('.html')) continue

      const filePath = join(subDir, file.name)
      try {
        const raw = await readFile(filePath, 'utf-8')
        const { data, content } = matter(raw)

        templates.push({
          id: data.id ?? `${entry.name}/${file.name.replace(/\.(md|html)$/, '')}`,
          name: data.name ?? file.name,
          description: data.description,
          type: (data.type ?? (file.name.endsWith('.html') ? 'html' : 'markdown')) as ArtifactType,
          skillId: data.skillId,
          content: content.trim(),
          variables: (data.variables ?? []) as TemplateVariable[],
        })
      } catch {
        // Skip invalid template files
      }
    }
  }

  cached = templates
  return templates
}

export function invalidateTemplateCache(): void {
  cached = null
}

export function renderTemplate(template: ArtifactTemplate, variables: Record<string, string>): string {
  return template.content.replace(/\{\{(\w+)\}\}/g, (_, name: string) => variables[name] ?? `{{${name}}}`)
}
