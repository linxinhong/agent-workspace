import { useState, useEffect, useRef } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import type { Notification, NotificationType } from '@agent-workspace/contracts'

const typeIcons: Record<string, string> = {
  'job.success': '✓',
  'job.error': '✗',
  'job.paused': '⏸',
  'job.needs-reapproval': '⚠',
  'export.complete': '⬇',
  'webhook.failed': '⚠',
}

const typeColors: Record<string, string> = {
  'job.success': 'text-green-600',
  'job.error': 'text-red-500',
  'job.paused': 'text-yellow-600',
  'job.needs-reapproval': 'text-orange-500',
  'export.complete': 'text-blue-600',
  'webhook.failed': 'text-orange-500',
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  return `${Math.floor(seconds / 86400)} 天前`
}

export function NotificationBell() {
  const { state, refreshUnreadCount, loadNotifications, markNotificationRead, markAllNotificationsRead, openRunDetail, openArtifact } = useWorkspace()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    refreshUnreadCount()
    const timer = setInterval(refreshUnreadCount, 30_000)
    return () => clearInterval(timer)
  }, [state.currentProjectId])

  useEffect(() => {
    if (!open) return
    loadNotifications()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleClick = (n: Notification) => {
    markNotificationRead(n.id)
    const meta = n.metadata as Record<string, unknown> | null
    if (meta?.runId && typeof meta.runId === 'string') {
      openRunDetail(meta.runId)
    } else if (meta?.artifactIds) {
      const ids = meta.artifactIds as string[]
      if (ids.length > 0) openArtifact(ids[0])
    }
    setOpen(false)
  }

  const count = state.unreadNotificationCount

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border z-50 max-h-96 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
            <span className="text-xs font-semibold text-gray-700">通知</span>
            {count > 0 && (
              <button onClick={() => markAllNotificationsRead()} className="text-[10px] text-blue-600 hover:text-blue-800">
                全部已读
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {state.notifications.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-6">暂无通知</div>
            ) : state.notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-gray-50 ${!n.readAt ? 'bg-blue-50/40' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-sm mt-0.5 ${typeColors[n.type] ?? 'text-gray-400'}`}>
                    {typeIcons[n.type] ?? '•'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{n.title}</p>
                    {n.message && (
                      <p className="text-[10px] text-gray-500 truncate">{n.message}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
