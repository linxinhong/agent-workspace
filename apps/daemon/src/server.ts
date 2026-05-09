import './env.js'

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { skillsRoute } from './routes/skills'
import { artifactsRoute } from './routes/artifacts'
import { runRoute } from './routes/run'
import { runsRoute } from './routes/runs'
import { projectsRoute } from './routes/projects'
import { filesRoute } from './routes/files'
import { debugRoute } from './routes/debug'
import { templatesRoute } from './routes/templates'
import { agentsRoute } from './routes/agents'

const app = new Hono()

app.use('/api/*', cors())

app.route('/', skillsRoute)
app.route('/', projectsRoute)
app.route('/', filesRoute)
app.route('/', artifactsRoute)
app.route('/', runRoute)
app.route('/', runsRoute)
app.route('/', debugRoute)
app.route('/', templatesRoute)
app.route('/', agentsRoute)

app.use('/*', serveStatic({ root: '../web/dist' }))

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Daemon running at http://localhost:${info.port}`)
})
