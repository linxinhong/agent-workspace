import { Hono } from 'hono'
import { loadSkills } from '../skills/skill-loader'

export const skillsRoute = new Hono()

skillsRoute.get('/api/skills', async (c) => {
  const skills = await loadSkills()
  return c.json(skills.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    outputTypes: s.outputTypes,
  })))
})
