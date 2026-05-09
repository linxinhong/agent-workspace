import { Hono } from 'hono'
import { z } from 'zod'
import { loadTemplates, renderTemplate } from '../templates/template-loader'

export const templatesRoute = new Hono()

templatesRoute.get('/api/templates', async (c) => {
  const templates = await loadTemplates()
  return c.json(templates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    type: t.type,
    skillId: t.skillId,
    variableCount: t.variables.length,
  })))
})

templatesRoute.get('/api/templates/:id', async (c) => {
  const templates = await loadTemplates()
  const template = templates.find(t => t.id === c.req.param('id'))
  if (!template) return c.json({ error: 'Template not found' }, 404)
  return c.json(template)
})

const RenderSchema = z.object({
  variables: z.record(z.string(), z.string()).default({}),
})

templatesRoute.post('/api/templates/:id/render', async (c) => {
  const templates = await loadTemplates()
  const template = templates.find(t => t.id === c.req.param('id'))
  if (!template) return c.json({ error: 'Template not found' }, 404)

  const raw = await c.req.json()
  const parsed = RenderSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, 400)
  }

  const content = renderTemplate(template, parsed.data.variables)
  return c.json({
    type: template.type,
    title: template.name,
    content,
  })
})
