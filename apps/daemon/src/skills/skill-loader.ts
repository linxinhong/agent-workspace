import { readdir, readFile } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import type { Skill, SkillWarning, ArtifactType } from '@agent-workspace/contracts'

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

export function validateSkill(skill: Skill): SkillWarning[] {
  const warnings: SkillWarning[] = []
  const text = skill.instruction.toLowerCase()

  for (const section of ['output contract'] as const) {
    if (!text.includes(section))
      warnings.push({ type: 'missing_section', message: `缺少 "${section}" 章节` })
  }
  for (const section of ['role', 'goal', 'workflow', 'constraints'] as const) {
    if (!text.includes(section))
      warnings.push({ type: 'missing_section', message: `建议添加 "${section}" 章节` })
  }
  if (!skill.outputTypes || skill.outputTypes.length === 0)
    warnings.push({ type: 'missing_output_types', message: '未定义输出类型' })

  return warnings
}
