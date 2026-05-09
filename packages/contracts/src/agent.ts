import type { UserGoal } from './goal'
import type { Skill } from './skill'
import type { Artifact } from './artifact'

// --- Existing API Provider types ---

export interface AgentProvider {
  run(input: AgentProviderInput): AsyncIterable<string>
}

export interface AgentProviderInput {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  model: string
}

export interface AgentRunInput {
  goal: UserGoal
  skill?: Skill
  provider: AgentProvider
  model?: string
}

export type AgentEvent =
  | { type: 'start'; goalId: string }
  | { type: 'delta'; content: string }
  | { type: 'artifact'; artifact: Artifact }
  | { type: 'error'; error: string }
  | { type: 'done' }

// --- Local Agent Adapter types ---

export type AgentKind = 'api' | 'cli'

export interface AgentPermissions {
  readProjectFiles: boolean
  writeArtifactFiles: boolean
  writeProjectFiles: boolean
  networkAccess: boolean
  executeCommands: boolean
  requiresApproval: boolean
  sendsDataToRemote?: boolean
  remoteEndpoint?: string
}

export interface AgentDescriptor {
  id: string
  name: string
  description?: string
  kind: AgentKind
  command?: string
  args?: string[]
  detected: boolean
  version?: string
  permissions?: AgentPermissions
}
