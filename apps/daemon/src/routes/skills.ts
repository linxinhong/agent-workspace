import { Hono } from 'hono'
import { loadSkills, invalidateSkillCache, validateSkill } from '../skills/skill-loader'

export const skillsRoute = new Hono()

skillsRoute.get('/api/skills', async (c) => {
  const skills = await loadSkills()
  return c.json(skills.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    outputTypes: s.outputTypes,
    warningCount: validateSkill(s).length,
  })))
})

skillsRoute.get('/api/skills/:id', async (c) => {
  const skills = await loadSkills()
  const skill = skills.find(s => s.id === c.req.param('id'))
  if (!skill) return c.json({ error: 'Skill not found' }, 404)
  return c.json({
    ...skill,
    path: `skills/${skill.id}/SKILL.md`,
    warnings: validateSkill(skill),
  })
})

skillsRoute.post('/api/skills/reload', async (c) => {
  invalidateSkillCache()
  const skills = await loadSkills()
  return c.json({ count: skills.length })
})
