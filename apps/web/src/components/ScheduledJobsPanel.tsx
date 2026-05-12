import { useState, useEffect, useCallback } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import {
  fetchScheduledJobs, createScheduledJob, deleteScheduledJob,
  enableScheduledJob, disableScheduledJob, runNowScheduledJob, fetchJobExecutions,
  validateCron, reapproveScheduledJob, fetchSchedulerStatus, fetchDeliveryAttempts,
} from '../services/api'
import type { ScheduledJob, ScheduledJobExecution, DeliveryAttempt } from '@agent-workspace/contracts'

const statusColors: Record<string, string> = {
  enabled: 'bg-green-100 text-green-700',
  disabled: 'bg-gray-100 text-gray-500',
  paused: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  'needs-reapproval': 'bg-orange-100 text-orange-700',
}

const statusLabels: Record<string, string> = {
  enabled: '启用',
  disabled: '已禁用',
  paused: '已暂停',
  error: '错误',
  'needs-reapproval': '需重新确认',
}

function formatSchedule(job: ScheduledJob): string {
  if (job.scheduleType === 'once') return `一次 ${job.runAt ? new Date(job.runAt).toLocaleString() : ''}`
  if (job.scheduleType === 'interval') {
    const s = job.intervalSeconds ?? 0
    if (s >= 3600) return `每 ${(s / 3600).toFixed(0)} 小时`
    if (s >= 60) return `每 ${(s / 60).toFixed(0)} 分钟`
    return `每 ${s} 秒`
  }
  return `cron: ${job.cron ?? ''}`
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

function SchedulerStatusBar() {
  const [status, setStatus] = useState<{ running: boolean; lastTickAt: string | null; activeExecutionCount: number } | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const s = await fetchSchedulerStatus()
        setStatus({ running: s.running, lastTickAt: s.lastTickAt, activeExecutionCount: s.activeExecutionCount })
      } catch { /* ignore */ }
    }
    load()
    const timer = setInterval(load, 10_000)
    return () => clearInterval(timer)
  }, [])

  if (!status) return null

  return (
    <div className="px-3 py-1.5 border-b bg-gray-50 flex items-center gap-2 text-[10px] text-gray-500">
      <span className={status.running ? 'text-green-600' : 'text-red-500'}>
        {status.running ? '●' : '○'} 调度器{status.running ? '运行中' : '已停止'}
      </span>
      {status.lastTickAt && (
        <span>上次 tick: {timeAgo(status.lastTickAt)} 前</span>
      )}
      {status.activeExecutionCount > 0 && (
        <span className="text-blue-600">执行中: {status.activeExecutionCount}</span>
      )}
    </div>
  )
}

export function ScheduledJobsPanel() {
  const { state, openRunDetail } = useWorkspace()
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [executions, setExecutions] = useState<ScheduledJobExecution[]>([])
  const [deliveryAttempts, setDeliveryAttempts] = useState<DeliveryAttempt[]>([])

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchScheduledJobs(state.currentProjectId ?? undefined)
      setJobs(data)
    } catch { /* ignore */ }
  }, [state.currentProjectId])

  useEffect(() => { loadJobs() }, [loadJobs])

  const handleExpand = async (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null)
      return
    }
    setExpandedJob(jobId)
    try {
      const [exData, daData] = await Promise.all([
        fetchJobExecutions(jobId),
        fetchDeliveryAttempts({ jobId }),
      ])
      setExecutions(exData)
      setDeliveryAttempts(daData)
    } catch { /* ignore */ }
  }

  const handleRunNow = async (id: string) => {
    try { await runNowScheduledJob(id) } catch { /* ignore */ }
  }

  const handleToggle = async (job: ScheduledJob) => {
    try {
      if (job.status === 'enabled') await disableScheduledJob(job.id)
      else await enableScheduledJob(job.id)
      await loadJobs()
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此定时任务？')) return
    try { await deleteScheduledJob(id); await loadJobs() } catch { /* ignore */ }
  }

  const handleReapprove = async (job: ScheduledJob) => {
    const hash = job.permissionsHash
    if (!hash) return
    try {
      await reapproveScheduledJob(job.id, { approved: true, permissionsHash: hash })
      await loadJobs()
    } catch { /* ignore */ }
  }

  const handleCopyPath = async (path: string) => {
    try { await navigator.clipboard.writeText(path) } catch { /* ignore */ }
  }

  if (!state.currentProjectId) return null

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">定时任务</span>
        <button onClick={() => setShowCreate(true)} className="text-xs text-blue-600 hover:text-blue-800">+ 新建</button>
      </div>

      <SchedulerStatusBar />

      <div className="flex-1 overflow-y-auto">
        {jobs.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-4">暂无定时任务</div>
        ) : jobs.map(job => (
          <div key={job.id} className="border-b border-gray-50">
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
              <button onClick={() => handleExpand(job.id)} className="text-xs text-gray-400 w-4">
                {expandedJob === job.id ? '▾' : '▸'}
              </button>
              <span className="text-xs text-gray-700 truncate flex-1" title={job.goal}>{job.name}</span>
              <span className={`text-[10px] px-1 py-0.5 rounded ${statusColors[job.status] ?? 'bg-gray-100'}`}>
                {statusLabels[job.status] ?? job.status}
              </span>
              <span className="text-[10px] text-gray-400">{formatSchedule(job)}</span>
            </div>

            {expandedJob === job.id && (
              <div className="px-3 pb-2 space-y-1.5">
                <p className="text-xs text-gray-600">{job.goal}</p>
                <p className="text-[10px] text-gray-400">Agent: {job.agentId}</p>
                {job.nextRunAt && (
                  <p className="text-[10px] text-gray-400">下次执行: {new Date(job.nextRunAt).toLocaleString()}</p>
                )}
                {job.lastRunAt && (
                  <p className="text-[10px] text-gray-400">上次执行: {new Date(job.lastRunAt).toLocaleString()}</p>
                )}

                {job.status === 'needs-reapproval' && (
                  <div className="bg-orange-50 rounded px-2 py-1.5 space-y-1">
                    <p className="text-[10px] text-orange-700">Agent 权限配置已变化，需要重新确认</p>
                    <div className="flex gap-1">
                      <button onClick={() => handleReapprove(job)} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 hover:bg-orange-200">重新确认</button>
                      <button onClick={() => handleToggle(job)} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">禁用任务</button>
                    </div>
                  </div>
                )}

                {job.status !== 'needs-reapproval' && (
                  <div className="flex gap-1">
                    <button onClick={() => handleRunNow(job.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">立即执行</button>
                    <button onClick={() => handleToggle(job)} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-600">
                      {job.status === 'enabled' ? '禁用' : '启用'}
                    </button>
                    <button onClick={() => handleDelete(job.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500">删除</button>
                  </div>
                )}

                {executions.length > 0 && (
                  <div className="mt-1">
                    <div className="text-[10px] text-gray-400 mb-0.5">执行历史</div>
                    {executions.slice(0, 5).map(ex => (
                      <div key={ex.id} className="flex items-center gap-1 text-[10px]">
                        <span className={`px-1 rounded ${ex.status === 'success' ? 'bg-green-50 text-green-600' : ex.status === 'error' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-500'}`}>
                          {ex.status}
                        </span>
                        <span className="text-gray-400">{new Date(ex.scheduledAt).toLocaleString()}</span>
                        {ex.runId && (
                          <button onClick={() => openRunDetail(ex.runId!)} className="text-blue-500 hover:underline">查看 Run</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {deliveryAttempts.length > 0 && (
                  <div className="mt-1">
                    <div className="text-[10px] text-gray-400 mb-0.5">交付记录</div>
                    {deliveryAttempts.slice(0, 5).map(da => (
                      <div key={da.id} className="flex items-center gap-1 text-[10px]">
                        <span className={da.status === 'success' ? 'text-green-600' : 'text-red-500'}>
                          {da.status === 'success' ? '✓' : '✗'}
                        </span>
                        <span className="text-gray-600">
                          {da.type === 'webhook' ? 'Webhook' : '导出'}
                        </span>
                        {da.statusCode && (
                          <span className="text-gray-500">{da.statusCode}</span>
                        )}
                        {da.error && (
                          <span className="text-red-400 truncate max-w-[120px]" title={da.error}>{da.error}</span>
                        )}
                        {da.target && da.type === 'auto-export' && (
                          <button onClick={() => handleCopyPath(da.target!)} className="text-blue-400 hover:text-blue-600 truncate max-w-[100px]" title={da.target}>
                            {da.target.split('/').slice(-2).join('/')}
                          </button>
                        )}
                        <span className="text-gray-400">{timeAgo(da.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateJobDialog
          projectId={state.currentProjectId}
          agents={state.agents}
          onClose={() => { setShowCreate(false); loadJobs() }}
        />
      )}
    </div>
  )
}

function CreateJobDialog({ projectId, agents, onClose }: {
  projectId: string
  agents: { id: string; name: string; kind: string }[]
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [agentId, setAgentId] = useState(agents[0]?.id ?? 'api-default')
  const [scheduleType, setScheduleType] = useState<'once' | 'interval' | 'cron'>('interval')
  const [intervalSeconds, setIntervalSeconds] = useState(3600)
  const [cron, setCron] = useState('0 9 * * *')
  const [runAt, setRunAt] = useState('')
  const [cronError, setCronError] = useState<string | null>(null)
  const [cronPreview, setCronPreview] = useState<string[]>([])
  const [showDelivery, setShowDelivery] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [onSuccess, setOnSuccess] = useState(true)
  const [onFailure, setOnFailure] = useState(true)
  const [autoExport, setAutoExport] = useState(false)
  const [exportFormat, setExportFormat] = useState<'markdown' | 'html'>('markdown')
  const [saving, setSaving] = useState(false)

  const handleCronChange = async (value: string) => {
    setCron(value)
    setCronError(null)
    setCronPreview([])
    if (!value.trim()) return
    try {
      const result = await validateCron(value)
      if (result.valid && result.nextRuns) {
        setCronPreview(result.nextRuns.map(d => new Date(d).toLocaleString()))
      } else {
        setCronError(result.error ?? '无效的 cron 表达式')
      }
    } catch {
      // Ignore network errors during typing
    }
  }

  const handleSave = async () => {
    if (!name.trim() || !goal.trim() || saving) return
    if (scheduleType === 'cron' && cronError) return
    setSaving(true)
    try {
      const delivery = (webhookUrl || autoExport) ? {
        webhookUrl: webhookUrl || undefined,
        onSuccess,
        onFailure,
        autoExport,
        exportFormat,
      } : undefined
      await createScheduledJob({
        projectId,
        name,
        goal,
        agentId,
        scheduleType,
        intervalSeconds: scheduleType === 'interval' ? intervalSeconds : undefined,
        cron: scheduleType === 'cron' ? cron : undefined,
        runAt: scheduleType === 'once' ? runAt || undefined : undefined,
        delivery,
      } as any)
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl w-[480px] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">新建定时任务</h3>

        <input value={name} onChange={e => setName(e.target.value)} placeholder="任务名称" className="w-full text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="执行目标" className="w-full text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none h-20" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Agent:</span>
          <select value={agentId} onChange={e => setAgentId(e.target.value)} className="text-xs border rounded px-2 py-1">
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">调度:</span>
          <select value={scheduleType} onChange={e => setScheduleType(e.target.value as any)} className="text-xs border rounded px-2 py-1">
            <option value="interval">固定间隔</option>
            <option value="cron">Cron 表达式</option>
            <option value="once">一次执行</option>
          </select>
          {scheduleType === 'interval' && (
            <select value={intervalSeconds} onChange={e => setIntervalSeconds(Number(e.target.value))} className="text-xs border rounded px-2 py-1">
              <option value={300}>每 5 分钟</option>
              <option value={900}>每 15 分钟</option>
              <option value={3600}>每 1 小时</option>
              <option value={21600}>每 6 小时</option>
              <option value={86400}>每 24 小时</option>
            </select>
          )}
          {scheduleType === 'cron' && (
            <input value={cron} onChange={e => handleCronChange(e.target.value)} className="text-xs border rounded px-2 py-1 flex-1 font-mono" placeholder="0 9 * * *" />
          )}
          {scheduleType === 'once' && (
            <input type="datetime-local" value={runAt} onChange={e => setRunAt(e.target.value)} className="text-xs border rounded px-2 py-1 flex-1" />
          )}
        </div>

        {cronError && (
          <p className="text-[10px] text-red-500 px-1">{cronError}</p>
        )}
        {cronPreview.length > 0 && (
          <div className="text-[10px] text-gray-400 px-1">
            <span>下次执行预览: </span>
            {cronPreview.slice(0, 3).map((d, i) => (
              <span key={i}>{i > 0 && ', '}{d}</span>
            ))}
          </div>
        )}

        <div className="border-t pt-2">
          <button onClick={() => setShowDelivery(!showDelivery)} className="text-xs text-gray-500 hover:text-gray-700">
            {showDelivery ? '▾' : '▸'} 交付配置
          </button>
          {showDelivery && (
            <div className="mt-2 space-y-2">
              <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="Webhook URL（可选）" className="w-full text-xs border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-[10px] text-gray-600">
                  <input type="checkbox" checked={onSuccess} onChange={e => setOnSuccess(e.target.checked)} className="rounded" /> 成功时触发
                </label>
                <label className="flex items-center gap-1 text-[10px] text-gray-600">
                  <input type="checkbox" checked={onFailure} onChange={e => setOnFailure(e.target.checked)} className="rounded" /> 失败时触发
                </label>
              </div>
              <label className="flex items-center gap-1 text-[10px] text-gray-600">
                <input type="checkbox" checked={autoExport} onChange={e => setAutoExport(e.target.checked)} className="rounded" /> 自动导出产物到本地
              </label>
              {autoExport && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">格式:</span>
                  <select value={exportFormat} onChange={e => setExportFormat(e.target.value as any)} className="text-[10px] border rounded px-2 py-0.5">
                    <option value="markdown">Markdown</option>
                    <option value="html">HTML</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-sm px-3 py-1 text-gray-500">取消</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !goal.trim() || !!cronError} className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
