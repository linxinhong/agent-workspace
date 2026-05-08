import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  skillId: text('skill_id'),
  createdAt: text('created_at').notNull(),
})

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull(),
  skillId: text('skill_id'),
  model: text('model'),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
})

export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  runId: text('run_id'),
  goalId: text('goal_id'),
  type: text('type').notNull(),
  title: text('title'),
  content: text('content').notNull(),
  parentArtifactId: text('parent_artifact_id'),
  version: integer('version').default(1),
  createdAt: text('created_at').notNull(),
})
