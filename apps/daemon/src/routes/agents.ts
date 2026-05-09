import { Hono } from 'hono'
import { getRegisteredAgents, detectCliAgents, getProfiles, getProfile, invalidateCache } from '../agents/registry.js'
import { validateAgentProfile } from '../agents/profiles/validate-agent-profile.js'

export const agentsRoute = new Hono()

agentsRoute.get('/api/agents', async (c) => {
  await detectCliAgents()
  return c.json(getRegisteredAgents())
})

agentsRoute.get('/api/agent-profiles', async (c) => {
  await detectCliAgents()
  const profiles = getProfiles()
  const agents = getRegisteredAgents()
  return c.json(profiles.map(p => {
    const agent = agents.find(a => a.id === p.id)
    const { warnings } = validateAgentProfile(p)
    return { ...p, available: agent?.detected ?? false, warnings }
  }))
})

agentsRoute.get('/api/agent-profiles/:id', async (c) => {
  const profile = getProfile(c.req.param('id'))
  if (!profile) return c.json({ error: 'Profile not found' }, 404)
  const { warnings } = validateAgentProfile(profile)
  const agents = getRegisteredAgents()
  const agent = agents.find(a => a.id === profile.id)
  return c.json({ ...profile, available: agent?.detected ?? false, warnings })
})

agentsRoute.post('/api/agent-profiles/reload', async (c) => {
  invalidateCache()
  await detectCliAgents()
  return c.json({ ok: true })
})
