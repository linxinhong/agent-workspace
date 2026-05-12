export type NotificationType =
  | 'job.success'
  | 'job.error'
  | 'job.paused'
  | 'job.needs-reapproval'
  | 'export.complete'
  | 'webhook.failed'

export interface Notification {
  id: string
  projectId: string | null
  type: NotificationType
  title: string
  message: string | null
  readAt: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface DeliveryConfig {
  webhookUrl?: string
  onSuccess?: boolean
  onFailure?: boolean
  autoExport?: boolean
  exportFormat?: 'markdown' | 'html'
}

export interface DeliveryAttempt {
  id: string
  projectId: string | null
  jobId: string | null
  executionId: string | null
  type: 'webhook' | 'auto-export'
  status: 'success' | 'error'
  target: string | null
  statusCode: number | null
  error: string | null
  createdAt: string
}
