export type AgentInputMode = 'stdin' | 'stdin-json' | 'argument' | 'prompt-file' | 'none'
export type PromptStrategy = 'full-inline' | 'read-prompt-file' | 'read-workspace-files'

export interface AgentCapabilities {
  streaming?: boolean
  fileEditing?: boolean
  supportsCwd?: boolean
  supportsEnv?: boolean
  supportsNonInteractive?: boolean
  ptyRequired?: boolean
}

export interface AgentProfile {
  id: string
  name: string
  kind: 'api' | 'local-cli' | 'local-tui' | 'acp'
  description?: string
  command?: string
  versionArgs?: string[]
  args?: string[]
  inputMode?: AgentInputMode
  outputFormat?: 'text' | 'stream-json'
  promptStrategy?: PromptStrategy
  promptInstruction?: string
  timeoutMs?: number
  enabled?: boolean
  capabilities?: AgentCapabilities
  acpEndpoint?: string
  acpAgentId?: string
}
