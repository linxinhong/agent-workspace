import { spawn, type ChildProcess } from 'node:child_process'
import type { AgentAdapter, AgentRunInput, AgentStreamEvent } from './types.js'

interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

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

    // JSON-RPC helpers
    let nextId = 0
    const pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

    const sendRequest = (method: string, params?: unknown): Promise<unknown> => {
      const id = nextId++
      return new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject })
        const msg: JsonRpcMessage = { jsonrpc: '2.0', id, method, params }
        proc.stdin!.write(JSON.stringify(msg) + '\n')
      })
    }

    const sendNotification = (method: string, params?: unknown): void => {
      const msg: JsonRpcMessage = { jsonrpc: '2.0', method, params }
      proc.stdin!.write(JSON.stringify(msg) + '\n')
    }

    // Queue for ACP events yielded to the caller
    const eventQueue: AgentStreamEvent[] = []
    let eventResolve: ((value: void) => void) | null = null
    let stdoutDone = false
    let sessionId: string | undefined

    const pushEvent = (event: AgentStreamEvent) => {
      eventQueue.push(event)
      if (eventResolve) {
        eventResolve()
        eventResolve = null
      }
    }

    const waitForEvent = (): Promise<void> => {
      if (eventQueue.length > 0 || stdoutDone) return Promise.resolve()
      return new Promise<void>((resolve) => { eventResolve = resolve })
    }

    // Parse stdout lines for JSON-RPC messages
    let buffer = ''
    proc.stdout!.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg: JsonRpcMessage = JSON.parse(line)

          if (msg.id !== undefined && pendingRequests.has(msg.id)) {
            const pending = pendingRequests.get(msg.id)!
            pendingRequests.delete(msg.id)
            if (msg.error) {
              pending.reject(new Error(msg.error.message))
            } else {
              pending.resolve(msg.result)
            }
          } else if (msg.method === 'session_update' && msg.params) {
            const p = msg.params as Record<string, unknown>
            const update = p.update as Record<string, unknown> | undefined
            if (update) {
              const type = update.type as string | undefined
              if (type === 'agent_message_chunk') {
                const items = (update.items as Array<Record<string, unknown>>) ?? []
                for (const item of items) {
                  if (item.type === 'text' && typeof item.text === 'string') {
                    pushEvent({ type: 'stdout', text: item.text })
                  }
                }
              } else if (type === 'agent_thought_chunk') {
                const items = (update.items as Array<Record<string, unknown>>) ?? []
                for (const item of items) {
                  if (item.type === 'text' && typeof item.text === 'string') {
                    pushEvent({ type: 'stdout', text: item.text })
                  }
                }
              }
            }
          }
        } catch {
          // Not JSON, forward as raw text
          pushEvent({ type: 'stdout', text: line })
        }
      }
    })

    proc.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim()
      if (text) pushEvent({ type: 'stderr', text })
    })

    proc.on('exit', () => {
      stdoutDone = true
      if (eventResolve) {
        eventResolve()
        eventResolve = null
      }
    })

    // ACP handshake
    try {
      const initResult = await sendRequest('initialize', {
        protocol_version: 1,
        client_info: { name: 'agent-workspace', version: '0.1.0' },
      }) as Record<string, unknown> | null

      if (!initResult) {
        pushEvent({ type: 'stderr', text: 'ACP initialize failed' })
        pushEvent({ type: 'exit', code: 1 })
        signal.removeEventListener('abort', onAbort)
        cleanup()
        return
      }

      const sessionResult = await sendRequest('new_session', {
        cwd: input.workspaceDir,
      }) as Record<string, unknown> | null

      if (!sessionResult) {
        pushEvent({ type: 'stderr', text: 'ACP new_session failed' })
        pushEvent({ type: 'exit', code: 1 })
        signal.removeEventListener('abort', onAbort)
        cleanup()
        return
      }

      sessionId = sessionResult.session_id as string | undefined

      // Send prompt
      await sendRequest('prompt', {
        session_id: sessionId,
        prompt: [{ type: 'text', text: input.goal }],
      })
    } catch (err) {
      pushEvent({ type: 'stderr', text: err instanceof Error ? err.message : 'ACP handshake error' })
      pushEvent({ type: 'exit', code: 1 })
      signal.removeEventListener('abort', onAbort)
      cleanup()
      return
    }

    // Stream events until process exits
    while (true) {
      await waitForEvent()
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!
      }
      if (stdoutDone) break
    }

    // Drain remaining
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
