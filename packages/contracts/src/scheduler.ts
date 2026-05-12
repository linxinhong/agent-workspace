export type ScheduleType = 'once' | 'interval' | 'cron'

export type ScheduledJobStatus =
  | 'enabled'
  | 'disabled'
  | 'paused'
  | 'error'
  | 'needs-reapproval'

export type MissedRunPolicy = 'skip' | 'run-once'

export interface ScheduledJob {
  id: string
  projectId: string
  name: string
  description?: string
  status: ScheduledJobStatus
  scheduleType: ScheduleType
  runAt?: string
  intervalSeconds?: number
  cron?: string
  goal: string
  agentId: string
  skillId?: string
  fileIds?: string[]
  outputMode: 'new-artifact'
  permissionsSnapshot?: string
  permissionsHash?: string
  consecutiveFailures: number
  missedRunPolicy?: MissedRunPolicy
  delivery?: string
  lastRunAt?: string
  nextRunAt?: string
  createdAt: string
  updatedAt: string
}

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'error'
  | 'skipped'

export interface ScheduledJobExecution {
  id: string
  jobId: string
  projectId: string
  runId?: string
  goalId?: string
  artifactIds?: string[]
  status: ExecutionStatus
  scheduledAt: string
  startedAt?: string
  endedAt?: string
  durationMs?: number
  error?: string
  createdAt: string
}
