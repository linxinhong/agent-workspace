import type { ScheduledJob } from '@agent-workspace/contracts'
import { db } from '../storage/db'
import { scheduledJobs, scheduledJobExecutions } from '../storage/schema'
import { eq, lte, and } from 'drizzle-orm'
import { computeNextRunAt } from './schedule-calculator.js'
import { runScheduledJob } from './job-runner.js'

export interface SchedulerStatus {
  running: boolean
  tickIntervalMs: number
  lastTickAt: string | null
  activeExecutionCount: number
}

export class SchedulerService {
  private timer?: ReturnType<typeof setInterval>
  private running = false
  private _lastTickAt: string | null = null
  private readonly tickIntervalMs = 10_000

  start(): void {
    this.recalcNextRunAt()
    this.timer = setInterval(() => void this.tick(), this.tickIntervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  getStatus(): SchedulerStatus {
    const activeExecutions = db.select({ id: scheduledJobExecutions.id })
      .from(scheduledJobExecutions)
      .where(eq(scheduledJobExecutions.status, 'running'))
      .all()
    return {
      running: true,
      tickIntervalMs: this.tickIntervalMs,
      lastTickAt: this._lastTickAt,
      activeExecutionCount: activeExecutions.length,
    }
  }

  private recalcNextRunAt(): void {
    const jobs = db.select().from(scheduledJobs)
      .where(eq(scheduledJobs.status, 'enabled'))
      .all() as unknown as ScheduledJob[]

    const now = new Date()
    for (const job of jobs) {
      if (!job.nextRunAt) {
        const next = computeNextRunAt(job, now)
        if (next) {
          db.update(scheduledJobs)
            .set({ nextRunAt: next.toISOString(), updatedAt: now.toISOString() })
            .where(eq(scheduledJobs.id, job.id))
            .run()
        }
        continue
      }

      // Handle expired nextRunAt (daemon was down)
      const nextRunDate = new Date(job.nextRunAt)
      if (nextRunDate <= now) {
        if (job.scheduleType === 'once') {
          // Expired one-shot job → disable
          db.update(scheduledJobs)
            .set({ status: 'disabled', updatedAt: now.toISOString() })
            .where(eq(scheduledJobs.id, job.id))
            .run()
        } else {
          // interval/cron → skip to next future run
          const next = computeNextRunAt(job, now)
          db.update(scheduledJobs)
            .set({
              nextRunAt: next?.toISOString() ?? null,
              status: next ? 'enabled' : 'disabled',
              updatedAt: now.toISOString(),
            })
            .where(eq(scheduledJobs.id, job.id))
            .run()
        }
      }
    }
  }

  async tick(): Promise<void> {
    if (this.running) return
    this.running = true

    try {
      this._lastTickAt = new Date().toISOString()
      const now = new Date().toISOString()
      const dueJobs = db.select().from(scheduledJobs)
        .where(and(
          eq(scheduledJobs.status, 'enabled'),
          lte(scheduledJobs.nextRunAt, now),
        ))
        .all() as unknown as ScheduledJob[]

      for (const job of dueJobs) {
        // Skip if already running
        const running = db.select({ id: scheduledJobExecutions.id })
          .from(scheduledJobExecutions)
          .where(and(
            eq(scheduledJobExecutions.jobId, job.id),
            eq(scheduledJobExecutions.status, 'running'),
          ))
          .get()
        if (running) continue

        await runScheduledJob(job)

        // Compute next run
        const next = computeNextRunAt(job, new Date())
        db.update(scheduledJobs)
          .set({
            nextRunAt: next?.toISOString() ?? null,
            status: next ? 'enabled' : 'disabled',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(scheduledJobs.id, job.id))
          .run()
      }
    } catch (err) {
      console.error('[scheduler] tick error:', err)
    } finally {
      this.running = false
    }
  }
}
