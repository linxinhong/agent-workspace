import type { ArtifactType } from './artifact'

export interface Skill {
  id: string
  name: string
  description?: string
  instruction: string
  outputTypes: ArtifactType[]
}
