import type { AgentProfile, AgentInputMode } from './agent-profile.types.js'

export interface CliAdapterConfig {
  id: string
  command: string
  args: string[]
  inputMode: AgentInputMode
  timeoutMs: number
}

export function buildCliConfig(profile: AgentProfile): CliAdapterConfig {
  return {
    id: profile.id,
    command: profile.command ?? '',
    args: profile.args ?? [],
    inputMode: profile.inputMode ?? 'stdin',
    timeoutMs: profile.timeoutMs ?? 120_000,
  }
}
