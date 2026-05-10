import { useEffect, useMemo } from 'react'
import type { Artifact } from '@agent-workspace/contracts'

interface ArtifactDraft {
  title: string
  content: string
  changeNote?: string
  updatedAt?: string
}

export function useArtifactDraft(params: {
  artifact: Artifact | null
  isEditing: boolean
  title: string
  content: string
  changeNote: string
}) {
  const draftKey = params.artifact ? `artifact-draft:${params.artifact.id}` : ''
  const isDirty = !!params.artifact && params.isEditing && (
    params.content !== params.artifact.content ||
    params.title !== (params.artifact.title ?? '')
  )

  useEffect(() => {
    if (!params.isEditing || !isDirty || !draftKey) return
    const timer = window.setTimeout(() => {
      const draft: ArtifactDraft = {
        title: params.title,
        content: params.content,
        changeNote: params.changeNote,
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(draftKey, JSON.stringify(draft))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [draftKey, isDirty, params.changeNote, params.content, params.isEditing, params.title])

  const savedDraft = useMemo(() => {
    if (!draftKey) return null
    const raw = localStorage.getItem(draftKey)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as ArtifactDraft
      if (typeof parsed.content !== 'string' || typeof parsed.title !== 'string') return null
      return parsed
    } catch {
      return null
    }
  }, [draftKey])

  const clearDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey)
  }

  return { draftKey, isDirty, savedDraft, clearDraft }
}
