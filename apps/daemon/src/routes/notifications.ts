import { Hono } from 'hono'
import { eq, desc, and, isNull, sql, or } from 'drizzle-orm'
import { db } from '../storage/db'
import { notifications, deliveryAttempts } from '../storage/schema'
import type { Notification, DeliveryAttempt } from '@agent-workspace/contracts'

function rowToNotification(row: any): Notification {
  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }
}

export const notificationsRoute = new Hono()

notificationsRoute.get('/api/notifications', async (c) => {
  const projectId = c.req.query('projectId')
  const unreadOnly = c.req.query('unreadOnly') === 'true'
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)

  const conditions = []
  if (projectId) {
    conditions.push(or(
      eq(notifications.projectId, projectId),
      isNull(notifications.projectId),
    )!)
  }
  if (unreadOnly) {
    conditions.push(isNull(notifications.readAt))
  }

  const rows = db.select().from(notifications)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .all()

  return c.json(rows.map(rowToNotification))
})

notificationsRoute.get('/api/notifications/unread-count', async (c) => {
  const projectId = c.req.query('projectId')

  const conditions = [isNull(notifications.readAt)]
  if (projectId) {
    conditions.push(or(
      eq(notifications.projectId, projectId),
      isNull(notifications.projectId),
    )!)
  }

  const rows = db.select({ id: notifications.id })
    .from(notifications)
    .where(and(...conditions))
    .all()

  return c.json({ count: rows.length })
})

notificationsRoute.patch('/api/notifications/:id/read', async (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(notifications).where(eq(notifications.id, id)).get()
  if (!existing) return c.json({ error: 'Notification not found' }, 404)

  const now = new Date().toISOString()
  db.update(notifications)
    .set({ readAt: now })
    .where(eq(notifications.id, id))
    .run()

  return c.json(rowToNotification(db.select().from(notifications).where(eq(notifications.id, id)).get()!))
})

notificationsRoute.post('/api/notifications/mark-all-read', async (c) => {
  const body = await c.req.json<{ projectId?: string }>().catch(() => ({}))
  const now = new Date().toISOString()

  const conditions = [isNull(notifications.readAt)]
  if (body.projectId) {
    conditions.push(or(
      eq(notifications.projectId, body.projectId),
      isNull(notifications.projectId),
    )!)
  }

  db.update(notifications)
    .set({ readAt: now })
    .where(and(...conditions))
    .run()

  const remaining = db.select({ id: notifications.id })
    .from(notifications)
    .where(isNull(notifications.readAt))
    .all()

  return c.json({ ok: true, count: remaining.length })
})

notificationsRoute.delete('/api/notifications/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(notifications).where(eq(notifications.id, id)).get()
  if (!existing) return c.json({ error: 'Notification not found' }, 404)

  db.delete(notifications).where(eq(notifications.id, id)).run()
  return c.json({ ok: true })
})

// Delivery attempts
notificationsRoute.get('/api/delivery-attempts', async (c) => {
  const jobId = c.req.query('jobId')
  const executionId = c.req.query('executionId')
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  const conditions = []
  if (jobId) conditions.push(eq(deliveryAttempts.jobId, jobId))
  if (executionId) conditions.push(eq(deliveryAttempts.executionId, executionId))

  const rows = db.select().from(deliveryAttempts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(deliveryAttempts.createdAt))
    .limit(limit)
    .all()

  return c.json(rows as unknown as DeliveryAttempt[])
})
