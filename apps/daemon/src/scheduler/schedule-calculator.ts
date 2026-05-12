import { CronExpressionParser } from 'cron-parser'
import type { ScheduledJob } from '@agent-workspace/contracts'

export function computeNextRunAt(job: ScheduledJob, from = new Date()): Date | null {
  if (job.scheduleType === 'once') {
    if (!job.runAt) return null
    const runAt = new Date(job.runAt)
    return runAt > from ? runAt : null
  }

  if (job.scheduleType === 'interval') {
    const seconds = job.intervalSeconds ?? 0
    if (seconds <= 0) return null
    const base = job.lastRunAt ? new Date(job.lastRunAt) : from
    return new Date(base.getTime() + seconds * 1000)
  }

  if (job.scheduleType === 'cron' && job.cron) {
    try {
      const interval = CronExpressionParser.parse(job.cron, { currentDate: from })
      return interval.next().toDate()
    } catch {
      return null
    }
  }

  return null
}
