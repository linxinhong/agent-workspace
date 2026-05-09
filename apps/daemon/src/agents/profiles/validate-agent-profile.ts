import type { AgentProfile, AgentInputMode, PromptStrategy } from './agent-profile.types.js'

const VALID_KINDS = ['api', 'local-cli', 'local-tui', 'acp']
const VALID_INPUT_MODES: AgentInputMode[] = ['stdin', 'stdin-json', 'argument', 'prompt-file', 'none']
const VALID_PROMPT_STRATEGIES: PromptStrategy[] = ['full-inline', 'read-prompt-file', 'read-workspace-files']
const ID_REGEX = /^[a-z0-9-]+$/

export function validateAgentProfile(raw: unknown): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []

  if (!raw || typeof raw !== 'object') return { valid: false, warnings: ['Not an object'] }

  const p = raw as Record<string, unknown>

  if (!p.id || typeof p.id !== 'string') return { valid: false, warnings: ['Missing id'] }
  if (!ID_REGEX.test(p.id)) return { valid: false, warnings: [`Invalid id format: ${p.id}`] }
  if (!p.name || typeof p.name !== 'string') return { valid: false, warnings: ['Missing name'] }
  if (!VALID_KINDS.includes(p.kind as string)) return { valid: false, warnings: [`Invalid kind: ${p.kind}`] }

  const kind = p.kind as string

  if (kind === 'local-cli' || kind === 'local-tui') {
    if (!p.command || typeof p.command !== 'string') return { valid: false, warnings: ['CLI kind requires command'] }
  }

  if (kind === 'acp') {
    if (!p.acpEndpoint || typeof p.acpEndpoint !== 'string') return { valid: false, warnings: ['ACP kind requires acpEndpoint'] }
  }

  if (p.inputMode && !VALID_INPUT_MODES.includes(p.inputMode as AgentInputMode)) {
    warnings.push(`Unknown inputMode: ${p.inputMode}`)
  }

  if (p.promptStrategy && !VALID_PROMPT_STRATEGIES.includes(p.promptStrategy as PromptStrategy)) {
    warnings.push(`Unknown promptStrategy: ${p.promptStrategy}`)
  }

  if (p.enabled === false) {
    warnings.push('Profile is disabled')
  }

  if (!p.capabilities) {
    warnings.push('No capabilities defined')
  }

  return { valid: true, warnings }
}
