export type ArtifactType =
  | 'markdown'
  | 'html'
  | 'json'
  | 'mermaid'
  | 'react'
  | 'bundle'

export type ArtifactSource = 'stdout' | 'file' | 'manual' | 'template' | 'refine' | 'fallback' | 'inline-edit'

export interface ArtifactBundleManifest {
  entry?: string
  files: Array<{
    path: string
    type: string
    size: number
    content: string
  }>
}

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
