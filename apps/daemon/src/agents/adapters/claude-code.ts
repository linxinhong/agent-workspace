import { GenericCliAdapter } from '../cli-adapter.js'

export function createClaudeCodeAdapter(): GenericCliAdapter {
  return new GenericCliAdapter({
    id: 'claude-code',
    command: 'claude',
    args: ['--print', '--output-format', 'text'],
    inputMode: 'stdin',
    timeoutMs: 120_000,
  })
}
