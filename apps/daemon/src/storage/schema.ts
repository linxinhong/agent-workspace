import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  skillId: text('skill_id'),
  projectId: text('project_id'),
  createdAt: text('created_at').notNull(),
})

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull(),
  skillId: text('skill_id'),
  model: text('model'),
  status: text('status').notNull(),
  projectId: text('project_id'),
  agentId: text('agent_id'),
  agentKind: text('agent_kind'),
  command: text('command'),
  cwd: text('cwd'),
  exitCode: integer('exit_code'),
  durationMs: integer('duration_ms'),
  stdoutPath: text('stdout_path'),
  stderrPath: text('stderr_path'),
  resultPath: text('result_path'),
  timedOut: integer('timed_out').default(0),
  cancelled: integer('cancelled').default(0),
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
  changeNote: text('change_note'),
  projectId: text('project_id'),
  createdAt: text('created_at').notNull(),
})

export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  mimeType: text('mime_type'),
  size: integer('size').notNull(),
  contentText: text('content_text'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
