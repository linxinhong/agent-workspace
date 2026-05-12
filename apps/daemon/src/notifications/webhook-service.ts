import { lookup } from 'node:dns/promises'
import { randomUUID } from 'node:crypto'
import { createNotification } from './notification-service.js'
import { db } from '../storage/db'
import { deliveryAttempts } from '../storage/schema'
import type { DeliveryAttempt } from '@agent-workspace/contracts'

function recordDeliveryAttempt(input: {
  projectId?: string | null
  jobId?: string
  executionId?: string
  type: 'webhook' | 'auto-export'
  status: 'success' | 'error'
  target?: string | null
  statusCode?: number | null
  error?: string | null
}): void {
  db.insert(deliveryAttempts).values({
    id: randomUUID(),
    projectId: input.projectId ?? null,
    jobId: input.jobId ?? null,
    executionId: input.executionId ?? null,
    type: input.type,
    status: input.status,
    target: input.target ?? null,
    statusCode: input.statusCode ?? null,
    error: input.error ?? null,
    createdAt: new Date().toISOString(),
  }).run()
}

export { recordDeliveryAttempt }

export type BlockReason =
  | 'blocked_loopback'
  | 'blocked_private_ip'
  | 'blocked_metadata_ip'
  | 'blocked_invalid_protocol'
  | 'dns_lookup_failed'

class WebhookValidationError extends Error {
  reason: BlockReason
  constructor(reason: BlockReason, message: string) {
    super(message)
    this.reason = reason
  }
}

const BLOCKED_CIDRS = [
  { prefix: '127.', len: 4 },
  { prefix: '169.254.', len: 8 },
  { prefix: '0.', len: 2 },
]

const BLOCKED_RANGES_10 = '10.'
const BLOCKED_RANGES_172 = '172.'
const BLOCKED_RANGES_192 = '192.168.'

function classifyBlockedIP(ip: string): BlockReason | null {
  if (ip.startsWith('127.') || ip === '::1' || ip === '::ffff:127.0.0.1') return 'blocked_loopback'
  if (ip.startsWith('169.254.') || ip.startsWith('fe80')) return 'blocked_metadata_ip'
  if (ip.startsWith(BLOCKED_RANGES_10)) return 'blocked_private_ip'
  if (ip.startsWith(BLOCKED_RANGES_172)) {
    const second = parseInt(ip.split('.')[1], 10)
    if (second >= 16 && second <= 31) return 'blocked_private_ip'
  }
  if (ip.startsWith(BLOCKED_RANGES_192)) return 'blocked_private_ip'
  if (ip.startsWith('0.')) return 'blocked_private_ip'
  if (ip === '::' || ip.startsWith('fc') || ip.startsWith('fd')) return 'blocked_private_ip'
  return null
}

async function validateWebhookUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new WebhookValidationError('blocked_invalid_protocol', 'Invalid URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new WebhookValidationError('blocked_invalid_protocol', 'Only http and https protocols are allowed')
  }

  const hostname = parsed.hostname
  try {
    const result = await lookup(hostname)
    const reason = classifyBlockedIP(result.address)
    if (reason) {
      throw new WebhookValidationError(reason, `Webhook target ${result.address} is not allowed (${reason})`)
    }
  } catch (err) {
    if (err instanceof WebhookValidationError) throw err
    throw new WebhookValidationError('dns_lookup_failed', `Cannot resolve hostname: ${hostname}`)
  }
}

export interface WebhookPayload {
  event: 'job.success' | 'job.error'
  jobId: string
  jobName: string
  executionId: string
  runId?: string
  artifactIds?: string[]
  error?: string
  durationMs?: number
  timestamp: string
  projectId?: string
}

export async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  options?: { timeoutMs?: number },
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const projectId = payload.projectId ?? null

  try {
    await validateWebhookUrl(url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'URL validation failed'
    const reason = err instanceof WebhookValidationError ? err.reason : 'dns_lookup_failed'
    recordDeliveryAttempt({ projectId, jobId: payload.jobId, executionId: payload.executionId, type: 'webhook', status: 'error', target: url, error: reason })
    createNotification({
      projectId,
      type: 'webhook.failed',
      title: `Webhook 交付失败`,
      message: `${reason}: ${msg}`,
      metadata: { webhookUrl: url, jobId: payload.jobId, reason },
    })
    return { success: false, error: reason }
  }

  const timeoutMs = options?.timeoutMs ?? 5000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const text = await res.text()
    void text.slice(0, 1024)

    if (!res.ok) {
      const errorReason = 'non_2xx'
      recordDeliveryAttempt({ projectId, jobId: payload.jobId, executionId: payload.executionId, type: 'webhook', status: 'error', target: url, statusCode: res.status, error: errorReason })
      return { success: false, statusCode: res.status, error: errorReason }
    }

    recordDeliveryAttempt({ projectId, jobId: payload.jobId, executionId: payload.executionId, type: 'webhook', status: 'success', target: url, statusCode: res.status })
    return { success: true, statusCode: res.status }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      recordDeliveryAttempt({ projectId, jobId: payload.jobId, executionId: payload.executionId, type: 'webhook', status: 'error', target: url, error: 'timeout' })
      return { success: false, error: 'timeout' }
    }
    const msg = err instanceof Error ? err.message : 'Request failed'
    recordDeliveryAttempt({ projectId, jobId: payload.jobId, executionId: payload.executionId, type: 'webhook', status: 'error', target: url, error: msg })
    createNotification({
      projectId,
      type: 'webhook.failed',
      title: `Webhook 交付失败`,
      message: msg,
      metadata: { webhookUrl: url, jobId: payload.jobId },
    })
    return { success: false, error: msg }
  } finally {
    clearTimeout(timer)
  }
}
