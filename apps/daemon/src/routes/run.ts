import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { loadSkills } from '../skills/skill-loader'
import { runAgent, type SaveRunData } from '../agent/run-agent'
import { db, DEFAULT_PROJECT_ID } from '../storage/db'
import { goals, runs, messages, artifacts } from '../storage/schema'
import { buildFileContext } from '../skills/file-context'
import { loadTemplates, renderTemplate } from '../templates/template-loader'

const RunRequestSchema = z.object({
  goal: z.string().min(1).max(8000),
  skillId: z.string().min(1).max(100).optional(),
  model: z.string().max(100).optional(),
  projectId: z.string().max(200).optional(),
  fileIds: z.array(z.string().max(200)).max(10).optional(),
  templateId: z.string().max(200).optional(),
  templateVariables: z.record(z.string(), z.string()).optional(),
})

export const runRoute = new Hono()

runRoute.post('/api/run', async (c) => {
  const raw = await c.req.json()
  const parsed = RunRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, 400)
  }
  const body = parsed.data

  const skills = await loadSkills()
  const skill = body.skillId ? skills.find(s => s.id === body.skillId) : undefined
  const model = body.model ?? process.env.PROVIDER_DEFAULT_MODEL ?? 'gpt-4.1'
  const projectId = body.projectId ?? DEFAULT_PROJECT_ID

  const goalId = randomUUID()
  const runId = randomUUID()
  const now = new Date().toISOString()

  const goal = {
    id: goalId,
    content: body.goal,
    skillId: body.skillId,
    projectId,
    createdAt: now,
  }

  const providerConfig = {
    apiKey: process.env.PROVIDER_API_KEY ?? '',
    baseUrl: process.env.PROVIDER_BASE_URL ?? 'https://api.openai.com/v1',
  }

  if (!providerConfig.apiKey) {
    return c.json({ error: 'PROVIDER_API_KEY is not configured' }, 500)
  }

  const saveRun = async (data: SaveRunData) => {
    db.insert(goals).values(data.goal).run()

    db.insert(runs).values({
      id: runId,
      goalId: data.goal.id,
      skillId: data.skillId,
      model: data.model,
      status: data.artifacts.length > 0 ? 'completed' : 'error',
      projectId,
      createdAt: now,
    }).run()

    for (const msg of data.messages) {
      db.insert(messages).values({
        id: randomUUID(),
        runId,
        role: msg.role,
        content: msg.content,
        createdAt: now,
      }).run()
    }

    for (const artifact of data.artifacts) {
      db.insert(artifacts).values({
        id: artifact.id,
        runId,
        goalId: data.goal.id,
        type: artifact.type,
        title: artifact.title,
        content: artifact.content,
        projectId,
        createdAt: artifact.createdAt,
      }).run()
    }
  }

  // Load file context if fileIds provided
  const fileContext = (body.fileIds && body.fileIds.length > 0)
    ? buildFileContext(body.fileIds, projectId)
    : undefined

  // Load template content if templateId provided
  let templateContent: string | undefined
  if (body.templateId) {
    const templates = await loadTemplates()
    const template = templates.find(t => t.id === body.templateId)
    if (template) {
      const rendered = renderTemplate(template, body.templateVariables ?? {})
      templateContent = `请基于以下模板内容完成用户目标：\n\n${rendered}`
    }
  }

  return streamSSE(c, async (stream) => {
    for await (const event of runAgent({
      goal,
      skill,
      model,
      providerConfig,
      saveRun,
      fileContext,
      templateContent,
    })) {
      let data: Record<string, unknown>
      switch (event.type) {
        case 'start':
          data = { goalId: event.goalId }
          break
        case 'delta':
          data = { content: event.content }
          break
        case 'artifact':
          data = { id: event.artifact.id, type: event.artifact.type, title: event.artifact.title }
          break
        case 'error':
          data = { error: event.error }
          break
        case 'done':
          data = { status: 'success' }
          break
      }
      await stream.writeSSE({ event: event.type, data: JSON.stringify(data) })
    }
  })
})
