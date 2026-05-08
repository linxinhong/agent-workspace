export interface WorkspaceFile {
  id: string
  projectId: string
  name: string
  path?: string
  mimeType: string | null
  size: number
  contentText?: string | null
  createdAt: string
  updatedAt: string
}
