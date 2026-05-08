import type { ArtifactType } from './artifact'

export interface Skill {
  id: string
  name: string
  description?: string
  instruction: string
  outputTypes: ArtifactType[]
}

export interface SkillWarning {
  type: 'missing_section' | 'missing_output_types'
  message: string
}

export interface SkillDetail extends Skill {
  path?: string
  warnings: SkillWarning[]
}
