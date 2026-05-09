import type { AgentAdapter, AgentRunInput, AgentStreamEvent } from './types.js'

export class AcpAdapter implements AgentAdapter {
  readonly id: string

  constructor(
    private endpoint: string,
    private agentId: string,
    private timeoutMs: number = 120_000,
  ) {
    this.id = agentId
  }

  async *run(input: AgentRunInput, signal: AbortSignal): AsyncIterable<AgentStreamEvent> {
    const url = `${this.endpoint.replace(/\/$/, '')}/runs`

    const body = JSON.stringify({
      agentId: this.agentId,
      messages: [
        { role: 'user', content: input.goal },
      ],
    })

    const timeoutId = setTimeout(() => signal.dispatchEvent(new Event('abort')), this.timeoutMs)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
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
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue

          if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim()
            if (!data) continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                yield { type: 'stdout', text: parsed.content }
              } else if (parsed.text) {
                yield { type: 'stdout', text: parsed.text }
              } else if (parsed.error) {
                yield { type: 'stderr', text: parsed.error }
              }
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
