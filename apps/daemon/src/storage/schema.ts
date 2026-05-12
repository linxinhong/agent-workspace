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
  approvalRequired: integer('approval_required').default(0),
  approvalGranted: integer('approval_granted').default(0),
  permissionsSnapshot: text('permissions_snapshot'),
  permissionsHash: text('permissions_hash'),
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
  source: text('source'),
  sourcePath: text('source_path'),
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
  source: text('source'),
  artifactId: text('artifact_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const scheduledJobs = sqliteTable('scheduled_jobs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  scheduleType: text('schedule_type').notNull(),
  runAt: text('run_at'),
  intervalSeconds: integer('interval_seconds'),
  cron: text('cron'),
  goal: text('goal').notNull(),
  agentId: text('agent_id').notNull(),
  skillId: text('skill_id'),
  fileIds: text('file_ids'),
  outputMode: text('output_mode').notNull(),
  permissionsSnapshot: text('permissions_snapshot'),
  permissionsHash: text('permissions_hash'),
  consecutiveFailures: integer('consecutive_failures').default(0),
  missedRunPolicy: text('missed_run_policy').default('skip'),
  delivery: text('delivery'),
  lastRunAt: text('last_run_at'),
  nextRunAt: text('next_run_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const scheduledJobExecutions = sqliteTable('scheduled_job_executions', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull(),
  projectId: text('project_id').notNull(),
  runId: text('run_id'),
  goalId: text('goal_id'),
  artifactIds: text('artifact_ids'),
  status: text('status').notNull(),
  scheduledAt: text('scheduled_at').notNull(),
  startedAt: text('started_at'),
  endedAt: text('ended_at'),
  durationMs: integer('duration_ms'),
  error: text('error'),
  createdAt: text('created_at').notNull(),
})

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message'),
  readAt: text('read_at'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
})

export const deliveryAttempts = sqliteTable('delivery_attempts', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  jobId: text('job_id'),
  executionId: text('execution_id'),
  type: text('type').notNull(),
  status: text('status').notNull(),
  target: text('target'),
  statusCode: integer('status_code'),
  error: text('error'),
  createdAt: text('created_at').notNull(),
})
