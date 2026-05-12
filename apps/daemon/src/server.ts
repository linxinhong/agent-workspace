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
import { scheduledJobsRoute } from './routes/scheduled-jobs'
import { notificationsRoute } from './routes/notifications'
import { SchedulerService } from './scheduler/scheduler-service'
import { detectCliAgents } from './agents/registry'

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
app.route('/', scheduledJobsRoute)
app.route('/', notificationsRoute)

// Scheduler
export const scheduler = new SchedulerService()
void detectCliAgents().then(() => scheduler.start())

app.use('/*', serveStatic({ root: '../web/dist' }))

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Daemon running at http://localhost:${info.port}`)
})
