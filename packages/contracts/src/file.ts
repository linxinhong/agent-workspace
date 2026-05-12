export type WorkspaceFileSource = 'upload' | 'artifact' | 'bundle'

export interface WorkspaceFile {
  id: string
  projectId: string
  name: string
  path?: string
  mimeType: string | null
  size: number
  contentText?: string | null
  source?: WorkspaceFileSource
  artifactId?: string
  createdAt: string
  updatedAt: string
}
