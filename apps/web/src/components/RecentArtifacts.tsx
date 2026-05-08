import { useWorkspace } from '../context/WorkspaceContext'

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

const typeIcons: Record<string, string> = {
  html: '📄',
  markdown: '📝',
  json: '🔧',
  mermaid: '📊',
  react: '⚛️',
}

export function RecentArtifacts() {
  const { state, openArtifact } = useWorkspace()

  if (state.artifactHistory.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-xs p-4 text-center">
        尚无历史 Artifact
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {state.artifactHistory.map((a) => (
        <button
          key={a.id}
          onClick={() => openArtifact(a.id)}
          className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
            state.activeArtifact?.id === a.id ? 'bg-blue-50' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{typeIcons[a.type] ?? '📄'}</span>
            <span className="text-sm text-gray-900 truncate flex-1">{a.title}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5 pl-6">
            {relativeTime(a.createdAt)}
          </div>
        </button>
      ))}
    </div>
  )
}
