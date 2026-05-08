export type ArtifactType =
  | 'markdown'
  | 'html'
  | 'json'
  | 'mermaid'
  | 'react'

export interface Artifact {
  id: string
  type: ArtifactType
  title: string
  content: string
  parentArtifactId?: string
  version?: number
  changeNote?: string
  createdAt: string
}

export interface ArtifactSummary {
  id: string
  goalId?: string | null
  type: ArtifactType
  title: string
  createdAt: string
}
