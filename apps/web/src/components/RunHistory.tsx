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

const statusColors: Record<string, string> = {
  completed: 'text-green-600',
  error: 'text-red-500',
  running: 'text-blue-500',
}

export function RunHistory() {
  const { state } = useWorkspace()

  if (state.runHistory.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-xs p-4 text-center">
        尚无执行记录
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {state.runHistory.map((run) => (
        <div key={run.id} className="px-3 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${statusColors[run.status] ?? 'text-gray-400'}`}>
              {run.status === 'completed' ? '✓' : run.status === 'error' ? '✗' : '●'}
            </span>
            <span className="text-xs text-gray-700 truncate flex-1">
              {run.goalContent?.slice(0, 60) ?? '(无目标)'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 pl-5">
            {run.skillId && (
              <span className="text-xs text-blue-500">{run.skillId}</span>
            )}
            <span className="text-xs text-gray-400">{relativeTime(run.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
