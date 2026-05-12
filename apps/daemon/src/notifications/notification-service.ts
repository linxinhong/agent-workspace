import { randomUUID } from 'node:crypto'
import type { Notification, NotificationType } from '@agent-workspace/contracts'
import { db } from '../storage/db'
import { notifications } from '../storage/schema'

export function createNotification(input: {
  projectId?: string | null
  type: NotificationType
  title: string
  message?: string
  metadata?: Record<string, unknown> | null
}): Notification {
  const row = {
    id: randomUUID(),
    projectId: input.projectId ?? null,
    type: input.type,
    title: input.title,
    message: input.message ?? null,
    readAt: null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    createdAt: new Date().toISOString(),
  }

  db.insert(notifications).values(row).run()

  return {
    ...row,
    projectId: row.projectId,
    metadata: input.metadata ?? null,
  }
}

export function createJobSuccessNotification(job: {
  id: string
  name: string
  projectId: string
}, result: {
  runId: string
  artifactIds: string[]
  executionId: string
}): void {
  const artifactCount = result.artifactIds.length
  createNotification({
    projectId: job.projectId,
    type: 'job.success',
    title: `${job.name} 执行完成`,
    message: artifactCount > 0
      ? `生成 ${artifactCount} 个产物`
      : '执行完成，未生成产物',
    metadata: {
      jobId: job.id,
      executionId: result.executionId,
      runId: result.runId,
      artifactIds: result.artifactIds,
    },
  })
}

export function createJobErrorNotification(job: {
  id: string
  name: string
  projectId: string
}, result: {
  executionId: string
  error: string
}): void {
  createNotification({
    projectId: job.projectId,
    type: 'job.error',
    title: `${job.name} 执行失败`,
    message: result.error,
    metadata: {
      jobId: job.id,
      executionId: result.executionId,
    },
  })
}

export function createJobPausedNotification(job: {
  id: string
  name: string
  projectId: string
}): void {
  createNotification({
    projectId: job.projectId,
    type: 'job.paused',
    title: `${job.name} 已暂停`,
    message: '连续失败达到上限，任务已自动暂停',
    metadata: { jobId: job.id },
  })
}
