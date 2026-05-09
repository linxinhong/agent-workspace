import { spawn, type ChildProcess } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import * as acp from '@agentclientprotocol/sdk'
import type { AgentAdapter, AgentRunInput, AgentStreamEvent } from './types.js'

type TransportKind = 'stdio' | 'http-sse'

export class AcpAdapter implements AgentAdapter {
  readonly id: string
  private transport: TransportKind
  private command: string
  private args: string[]
  private endpoint: string
  private acpAgentId: string
  private timeoutMs: number
  private process: ChildProcess | null = null

  constructor(opts: {
    id: string
    transport?: TransportKind
    command?: string
    args?: string[]
    endpoint?: string
    acpAgentId?: string
    timeoutMs?: number
  }) {
    this.id = opts.id
    this.transport = opts.transport ?? 'stdio'
    this.command = opts.command ?? ''
    this.args = opts.args ?? []
    this.endpoint = opts.endpoint ?? ''
    this.acpAgentId = opts.acpAgentId ?? opts.id
    this.timeoutMs = opts.timeoutMs ?? 120_000
  }

  async *run(input: AgentRunInput, signal: AbortSignal): AsyncIterable<AgentStreamEvent> {
    if (this.transport === 'stdio') {
      yield* this.runStdio(input, signal)
    } else {
      yield* this.runHttpSse(input, signal)
    }
  }

  cancel(): void {
    if (this.process) {
      try { this.process.kill('SIGKILL') } catch { /* ignore */ }
      this.process = null
    }
  }

  private async *runStdio(input: AgentRunInput, signal: AbortSignal): AsyncIterable<AgentStreamEvent> {
    const proc = spawn(this.command, this.args, {
      cwd: input.workspaceDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    })
    this.process = proc

    let killed = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      this.process = null
    }

    timeoutId = setTimeout(() => {
      killed = true
      try { proc.kill('SIGKILL') } catch { /* already exited */ }
    }, this.timeoutMs)

    const onAbort = () => {
      killed = true
      try { proc.kill('SIGKILL') } catch { /* already exited */ }
    }
    signal.addEventListener('abort', onAbort, { once: true })

    // Event queue for yielding to the caller
    const eventQueue: AgentStreamEvent[] = []
    let eventResolve: ((value: void) => void) | null = null
    let done = false

    const pushEvent = (event: AgentStreamEvent) => {
      eventQueue.push(event)
      if (eventResolve) { eventResolve(); eventResolve = null }
    }

    const waitForEvent = (): Promise<void> => {
      if (eventQueue.length > 0 || done) return Promise.resolve()
      return new Promise<void>((resolve) => { eventResolve = resolve })
    }

    // Create SDK stream from subprocess stdio
    const webStdin = Writable.toWeb(proc.stdin!)
    const webStdout = Readable.toWeb(proc.stdout!) as ReadableStream<Uint8Array>
    const stream = acp.ndJsonStream(webStdin, webStdout)

    // Client implementation — receives notifications from agent
    const client: acp.Client = {
      async requestPermission(params) {
        const first = params.options[0]
        return { outcome: { outcome: 'selected', optionId: first?.optionId ?? 'allow' } }
      },
      async sessionUpdate(params) {
        const update = params.update
        if (update.sessionUpdate === 'agent_message_chunk') {
          if (update.content.type === 'text') {
            pushEvent({ type: 'stdout', text: update.content.text })
          }
        }
      },
      async readTextFile() {
        return { content: '' }
      },
      async writeTextFile() {
        return {}
      },
      async createTerminal() {
        return { terminalId: 'none', title: '' }
      },
      async terminalOutput() {
        return { output: '', truncated: false }
      },
      async releaseTerminal() {
        return {}
      },
      async waitForTerminalExit() {
        return { exitCode: 0 }
      },
      async killTerminal() {
        return {}
      },
    }

    const conn = new acp.ClientSideConnection(() => client, stream)

    proc.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim()
      if (text) pushEvent({ type: 'stderr', text })
    })

    proc.on('exit', () => {
      done = true
      if (eventResolve) { eventResolve(); eventResolve = null }
    })

    // ACP handshake + prompt
    try {
      await conn.initialize({
        protocolVersion: 1,
        clientInfo: { name: 'agent-workspace', version: '0.1.0' },
      })

      const session = await conn.newSession({
        cwd: input.workspaceDir,
        mcpServers: [],
      })

      // Fire-and-forget prompt — stream notifications arrive via sessionUpdate callback
      conn.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: 'text', text: input.goal }],
      }).then(() => {
        done = true
        if (eventResolve) { eventResolve(); eventResolve = null }
        try { proc.kill('SIGTERM') } catch { /* ignore */ }
      }).catch(err => {
        pushEvent({ type: 'stderr', text: err instanceof Error ? err.message : 'prompt error' })
      })
    } catch (err) {
      pushEvent({ type: 'stderr', text: err instanceof Error ? err.message : 'ACP handshake error' })
      pushEvent({ type: 'exit', code: 1 })
      signal.removeEventListener('abort', onAbort)
      cleanup()
      return
    }

    // Stream events until done
    while (true) {
      await waitForEvent()
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!
      }
      if (done) break
    }

    while (eventQueue.length > 0) {
      yield eventQueue.shift()!
    }

    signal.removeEventListener('abort', onAbort)
    cleanup()

    if (killed) {
      yield { type: 'exit', code: null }
    }
  }

  private async *runHttpSse(input: AgentRunInput, signal: AbortSignal): AsyncIterable<AgentStreamEvent> {
    const url = `${this.endpoint.replace(/\/$/, '')}/runs`

    const body = JSON.stringify({
      agentId: this.acpAgentId,
      messages: [{ role: 'user', content: input.goal }],
    })

    const timeoutId = setTimeout(() => signal.dispatchEvent(new Event('abort')), this.timeoutMs)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body,
        signal,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        yield { type: 'stderr', text: `HTTP ${res.status}: ${errText.slice(0, 200)}` }
        yield { type: 'exit', code: 1 }
        return
      }

      if (!res.body) {
        yield { type: 'stderr', text: 'No response body' }
        yield { type: 'exit', code: 1 }
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let sseBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue

          if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim()
            if (!data) continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) yield { type: 'stdout', text: parsed.content }
              else if (parsed.text) yield { type: 'stdout', text: parsed.text }
              else if (parsed.error) yield { type: 'stderr', text: parsed.error }
            } catch {
              yield { type: 'stdout', text: data }
            }
          }
        }
      }

      yield { type: 'exit', code: 0 }
    } catch (err) {
      if (signal.aborted) {
        yield { type: 'exit', code: null }
      } else {
        yield { type: 'stderr', text: err instanceof Error ? err.message : 'Unknown error' }
        yield { type: 'exit', code: 1 }
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
