export type ArtifactType =
  | 'markdown'
  | 'html'
  | 'json'
  | 'mermaid'
  | 'react'

export type ArtifactSource = 'inline' | 'file' | 'manual' | 'template' | 'refine' | 'fallback'

export interface Artifact {
  id: string
  type: ArtifactType
  title: string
  content: string
  source?: ArtifactSource
  sourcePath?: string
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
