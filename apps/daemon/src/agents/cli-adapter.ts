import { spawn, type ChildProcess } from 'node:child_process'
import type { AgentAdapter, AgentRunInput, AgentStreamEvent } from './types.js'

const ALLOWED_ENV_KEYS = new Set(['PATH', 'HOME', 'LANG', 'TERM', 'NODE_ENV', 'USER', 'TMPDIR', 'TEMP', 'TMP'])

function sanitizeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const key of ALLOWED_ENV_KEYS) {
    if (process.env[key]) env[key] = process.env[key]
  }
  return env
}

export interface CliAdapterConfig {
  id: string
  command: string
  args: string[]
  inputMode: 'stdin' | 'stdin-json' | 'argument' | 'prompt-file' | 'none'
  outputFormat?: 'text' | 'stream-json'
  timeoutMs: number
}

export class GenericCliAdapter implements AgentAdapter {
  readonly id: string
  private process: ChildProcess | null = null

  constructor(private config: CliAdapterConfig) {
    this.id = config.id
  }

  async *run(input: AgentRunInput, signal: AbortSignal): AsyncIterable<AgentStreamEvent> {
    const { command, inputMode, timeoutMs } = this.config

    let spawnArgs = [...this.config.args]
    if (inputMode === 'argument') {
      spawnArgs = [...spawnArgs, input.goal]
    }

    const proc = spawn(command, spawnArgs, {
      cwd: input.workspaceDir,
      env: sanitizeEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.process = proc

    let killed = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      this.process = null
    }

    // Timeout
    timeoutId = setTimeout(() => {
      killed = true
      try { proc.kill('SIGKILL') } catch { /* already exited */ }
    }, timeoutMs)

    // AbortSignal
    const onAbort = () => {
      killed = true
      try { proc.kill('SIGKILL') } catch { /* already exited */ }
    }
    signal.addEventListener('abort', onAbort, { once: true })

    // stdin
    if (inputMode === 'stdin') {
      proc.stdin.write(input.goal)
      proc.stdin.end()
    } else if (inputMode === 'stdin-json') {
      proc.stdin.write(JSON.stringify({ role: 'user', content: input.goal }) + '\n')
      proc.stdin.end()
    } else {
      proc.stdin.end()
    }

    // stdout stream
    const rawStdout: AsyncIterable<string> = readableToAsync(proc.stdout!)
    const stderrChunks: AsyncIterable<string> = readableToAsync(proc.stderr!)
    const stdoutChunks = this.config.outputFormat === 'stream-json'
      ? parseStreamJson(rawStdout)
      : rawStdout

    // Merge stdout + stderr + exit into one async iterable
    yield* mergeStreams(stdoutChunks, stderrChunks, proc, signal)

    signal.removeEventListener('abort', onAbort)
    cleanup()

    if (killed) {
      yield { type: 'exit', code: null }
    }
  }

  cancel(): void {
    if (this.process) {
      try { this.process.kill('SIGKILL') } catch { /* ignore */ }
      this.process = null
    }
  }
}

async function* readableToAsync(stream: NodeJS.ReadableStream): AsyncIterable<string> {
  const reader = (stream as any)[Symbol.asyncIterator]()
  try {
    while (true) {
      const { value, done } = await reader.next()
      if (done) return
      if (value) yield value.toString()
    }
  } catch {
    // stream closed or error
  }
}

async function* mergeStreams(
  stdout: AsyncIterable<string>,
  stderr: AsyncIterable<string>,
  proc: ChildProcess,
  signal: AbortSignal,
): AsyncIterable<AgentStreamEvent> {
  const stdoutIter = stdout[Symbol.asyncIterator]()
  const stderrIter = stderr[Symbol.asyncIterator]()
  const exitPromise = new Promise<{ code: number | null }>((resolve) => {
    proc.on('exit', (code) => resolve({ code }))
  })

  const results: IteratorResult<string>[] = []
  let exitCode: { code: number | null } | null = null
  let pendingStdout = true
  let pendingStderr = true
  let pendingExit = true

  while (pendingStdout || pendingStderr || pendingExit) {
    const promises: Promise<any>[] = []
    const tags: string[] = []

    if (pendingStdout) { promises.push(stdoutIter.next().then(r => ({ tag: 'stdout', r }))); tags.push('stdout') }
    if (pendingStderr) { promises.push(stderrIter.next().then(r => ({ tag: 'stderr', r }))); tags.push('stderr') }
    if (pendingExit) { promises.push(exitPromise.then(r => ({ tag: 'exit', r }))); tags.push('exit') }

    if (promises.length === 0) break

    const winner = await Promise.race(promises)

    if (winner.tag === 'stdout') {
      if (winner.r.done) {
        pendingStdout = false
      } else {
        yield { type: 'stdout', text: winner.r.value }
      }
    } else if (winner.tag === 'stderr') {
      if (winner.r.done) {
        pendingStderr = false
      } else {
        yield { type: 'stderr', text: winner.r.value }
      }
    } else if (winner.tag === 'exit') {
      exitCode = winner.r
      pendingExit = false
      // Drain remaining stdout/stderr
      if (pendingStdout) {
        try {
          while (true) {
            const { value, done } = await stdoutIter.next()
            if (done) break
            yield { type: 'stdout', text: value }
          }
        } catch { /* ignore */ }
        pendingStdout = false
      }
      if (pendingStderr) {
        try {
          while (true) {
            const { value, done } = await stderrIter.next()
            if (done) break
            yield { type: 'stderr', text: value }
          }
        } catch { /* ignore */ }
        pendingStderr = false
      }
    }
  }

  if (exitCode) {
    yield { type: 'exit', code: exitCode.code }
  }
}

async function* parseStreamJson(source: AsyncIterable<string>): AsyncIterable<string> {
  let buffer = ''
  for await (const chunk of source) {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const obj = JSON.parse(trimmed)
        yield* extractStreamText(obj)
      } catch {
        yield trimmed
      }
    }
  }
  if (buffer.trim()) {
    try {
      yield* extractStreamText(JSON.parse(buffer.trim()))
    } catch {
      yield buffer.trim()
    }
  }
}

function* extractStreamText(obj: Record<string, any>): Generator<string> {
  const t = obj.type

  // Claude Code: {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
  if (t === 'assistant' && obj.message?.content) {
    for (const part of obj.message.content) {
      if (part.type === 'text' && typeof part.text === 'string') yield part.text
    }
    return
  }

  // Claude Code: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
  if (t === 'content_block_delta' && obj.delta?.text) {
    yield obj.delta.text
    return
  }

  // Kimi Code: {"role":"assistant","content":[{"type":"text","text":"..."}]}
  if (obj.role === 'assistant' && Array.isArray(obj.content)) {
    for (const part of obj.content) {
      if (part.type === 'text' && typeof part.text === 'string') yield part.text
    }
    return
  }

  // Kimi Code: {"type":"text","text":"..."}
  if (t === 'text' && typeof obj.text === 'string') {
    yield obj.text
    return
  }

  // Kimi Code: {"type":"notification","message":"..."}
  if (t === 'notification' && typeof obj.message === 'string') {
    yield obj.message
    return
  }

  // Skip: system, content_block_start, content_block_stop, message_start, message_delta, message_stop, etc.
}
