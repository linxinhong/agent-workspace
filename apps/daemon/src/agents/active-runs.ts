import type { AgentAdapter } from './types.js'

interface ActiveRun {
  abortController: AbortController
  adapter: AgentAdapter
}

const activeRuns = new Map<string, ActiveRun>()

export function registerActiveRun(runId: string, ctrl: AbortController, adapter: AgentAdapter): void {
  activeRuns.set(runId, { abortController: ctrl, adapter })
}

export function cancelActiveRun(runId: string): boolean {
  const entry = activeRuns.get(runId)
  if (!entry) return false
  entry.abortController.abort()
  try { (entry.adapter as any).cancel?.() } catch { /* ignore */ }
  return true
}

export function unregisterActiveRun(runId: string): void {
  activeRuns.delete(runId)
}
