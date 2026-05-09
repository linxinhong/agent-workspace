export interface AgentRunInput {
  goal: string
  systemPrompt: string
  skillInstruction?: string
  fileContext?: string
  templateContent?: string
  model?: string
  workspaceDir: string
}

export type AgentStreamEvent =
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'exit'; code: number | null }

export interface AgentAdapter {
  readonly id: string
  run(input: AgentRunInput, signal: AbortSignal): AsyncIterable<AgentStreamEvent>
}
