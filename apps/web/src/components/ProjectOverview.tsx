import { useEffect } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { fetchProjectDetail, type ProjectDetail } from '../services/api'
import { useState } from 'react'

export function ProjectOverview() {
  const { state } = useWorkspace()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)

  useEffect(() => {
    if (state.currentProjectId) {
      fetchProjectDetail(state.currentProjectId).then(setDetail)
    }
  }, [state.currentProjectId, state.artifactHistory.length, state.runHistory.length])

  if (!detail) return null

  return (
    <div className="px-3 py-2.5 border-b border-gray-100">
      <div className="text-sm font-medium text-gray-900 truncate">{detail.name}</div>
      {detail.description && (
        <div className="text-xs text-gray-400 mt-0.5 truncate">{detail.description}</div>
      )}
      <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
        <span>{detail.artifactCount} artifacts</span>
        <span>{detail.runCount} runs</span>
      </div>
    </div>
  )
}
