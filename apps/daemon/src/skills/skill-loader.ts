import { readdir, readFile } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import type { Skill, ArtifactType } from '@agent-workspace/contracts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const PROJECT_ROOT = resolve(__dirname, '../../../../')

let cached: Skill[] | null = null

export async function loadSkills(basePath?: string): Promise<Skill[]> {
  if (cached) return cached

  const skillsDir = basePath ?? join(PROJECT_ROOT, 'skills')
  let entries: Dirent[]
  try {
    entries = await readdir(skillsDir, { withFileTypes: true })
  } catch {
    return []
  }

  const skills: Skill[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const skillFile = join(skillsDir, entry.name, 'SKILL.md')
    try {
      const raw = await readFile(skillFile, 'utf-8')
      const { data, content } = matter(raw)

      skills.push({
        id: data.id ?? entry.name,
        name: data.name ?? entry.name,
        description: data.description,
        instruction: content.trim(),
        outputTypes: (data.output ?? ['markdown']) as ArtifactType[],
      })
    } catch {
      // Skip invalid skill directories
    }
  }

  cached = skills
  return skills
}

export function invalidateSkillCache(): void {
  cached = null
}
