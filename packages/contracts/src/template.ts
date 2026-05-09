import type { ArtifactType } from './artifact'

export interface TemplateVariable {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select'
  required?: boolean
  defaultValue?: string
  options?: string[]
}

export interface ArtifactTemplate {
  id: string
  name: string
  description?: string
  type: ArtifactType
  skillId?: string
  content: string
  variables: TemplateVariable[]
}
