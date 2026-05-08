import './env.js'

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { skillsRoute } from './routes/skills'
import { artifactsRoute } from './routes/artifacts'
import { runRoute } from './routes/run'
import { runsRoute } from './routes/runs'

const app = new Hono()

app.use('/api/*', cors())

app.route('/', skillsRoute)
app.route('/', artifactsRoute)
app.route('/', runRoute)
app.route('/', runsRoute)

app.use('/*', serveStatic({ root: '../web/dist' }))

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Daemon running at http://localhost:${info.port}`)
})
