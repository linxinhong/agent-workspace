import { createHash } from 'node:crypto'
import type { AgentPermissions } from './agent-profile.types.js'

const PERMISSION_KEYS: (keyof AgentPermissions)[] = [
  'readProjectFiles',
  'writeArtifactFiles',
  'writeProjectFiles',
  'networkAccess',
  'executeCommands',
  'requiresApproval',
  'sendsDataToRemote',
  'remoteEndpoint',
]

export function hashPermissions(permissions: AgentPermissions): string {
  const sorted = PERMISSION_KEYS.reduce<Record<string, unknown>>((acc, key) => {
    if (permissions[key] !== undefined) acc[key] = permissions[key]
    return acc
  }, {})
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 16)
}
