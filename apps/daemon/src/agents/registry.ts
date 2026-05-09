import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AgentDescriptor } from '@agent-workspace/contracts'
import type { AgentAdapter } from './types.js'
import { GenericCliAdapter } from './cli-adapter.js'
import { AcpAdapter } from './acp-adapter.js'
import { loadProfiles, invalidateProfileCache } from './profiles/agent-profile-loader.js'
import { buildCliConfig } from './profiles/build-cli-command.js'
import type { AgentProfile } from './profiles/agent-profile.types.js'

const execFileAsync = promisify(execFile)

let cachedAgents: AgentDescriptor[] | null = null
let cachedProfiles: AgentProfile[] | null = null

const API_AGENT: AgentDescriptor = {
  id: 'api-default',
  name: 'API Provider',
  description: 'OpenAI-compatible API（默认）',
  kind: 'api',
  detected: true,
}

async function detectCliAgent(profile: AgentProfile): Promise<AgentDescriptor> {
  const command = profile.command ?? ''
  const args = profile.args ?? []
  try {
    const { stdout } = await execFileAsync('which', [command], { timeout: 3000 })
    if (!stdout.trim()) {
      return {
        id: profile.id, name: profile.name,
        description: profile.description ?? '',
        kind: 'cli', command, args, detected: false, permissions: profile.permissions,
      }
    }
    let version: string | undefined
    if (profile.versionArgs?.length) {
      try {
        const vOut = await execFileAsync(command, profile.versionArgs, { timeout: 5000 })
        version = vOut.stdout.trim().split('\n')[0] || undefined
      } catch { /* version detection is best-effort */ }
    }
    return {
      id: profile.id, name: profile.name,
      description: profile.description ?? '',
      kind: 'cli', command, args, detected: true, version, permissions: profile.permissions,
    }
  } catch {
    return {
      id: profile.id, name: profile.name,
      description: profile.description ?? '',
      kind: 'cli', command, args, detected: false, permissions: profile.permissions,
    }
  }
}

function acpToDescriptor(profile: AgentProfile): AgentDescriptor {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description ?? '',
    kind: 'cli',
    command: profile.acpEndpoint ?? '',
    args: [],
    detected: true,
    permissions: profile.permissions,
  }
}

export async function detectCliAgents(): Promise<void> {
  const profiles = loadProfiles().filter(p => p.enabled !== false)
  cachedProfiles = profiles

  const cliProfiles = profiles.filter(p => p.kind === 'local-cli' || p.kind === 'local-tui')
  const acpProfiles = profiles.filter(p => p.kind === 'acp')

  const cliResults = await Promise.all(cliProfiles.map(detectCliAgent))
  const acpResults = acpProfiles.map(acpToDescriptor)

  cachedAgents = [API_AGENT, ...cliResults, ...acpResults]
}

export function getRegisteredAgents(): AgentDescriptor[] {
  if (!cachedAgents) {
    const profiles = loadProfiles().filter(p => p.enabled !== false)
    cachedProfiles = profiles
    const cliProfiles = profiles.filter(p => p.kind === 'local-cli' || p.kind === 'local-tui')
    const acpProfiles = profiles.filter(p => p.kind === 'acp')
    cachedAgents = [
      API_AGENT,
      ...cliProfiles.map(p => ({
        id: p.id, name: p.name, description: p.description ?? '',
        kind: 'cli' as const, command: p.command ?? '', args: p.args ?? [], detected: false, permissions: p.permissions,
      })),
      ...acpProfiles.map(p => ({
        id: p.id, name: p.name, description: p.description ?? '',
        kind: 'cli' as const, command: p.acpEndpoint ?? '', args: [], detected: true, permissions: p.permissions,
      })),
    ]
  }
  return cachedAgents
}

export function getAgent(id: string): AgentDescriptor | undefined {
  return getRegisteredAgents().find(a => a.id === id)
}

export function getProfile(id: string): AgentProfile | undefined {
  return (cachedProfiles ?? loadProfiles()).find(p => p.id === id)
}

export function getProfiles(): AgentProfile[] {
  return cachedProfiles ?? loadProfiles()
}

export function invalidateCache(): void {
  cachedAgents = null
  cachedProfiles = null
  invalidateProfileCache()
}

const adapterCache = new Map<string, AgentAdapter>()

export function getAdapter(id: string): AgentAdapter | null {
  if (id === 'api-default') return null

  const existing = adapterCache.get(id)
  if (existing) return existing

  const profiles = cachedProfiles ?? loadProfiles()
  const profile = profiles.find(p => p.id === id)
  if (!profile || profile.enabled === false) return null

  let adapter: AgentAdapter

  if (profile.kind === 'acp') {
    const isStdio = !profile.acpEndpoint || profile.acpEndpoint === 'stdio'
    adapter = new AcpAdapter({
      id: profile.id,
      transport: isStdio ? 'stdio' : 'http-sse',
      command: profile.command ?? '',
      args: profile.args ?? [],
      endpoint: isStdio ? '' : profile.acpEndpoint,
      acpAgentId: profile.acpAgentId ?? profile.id,
      timeoutMs: profile.timeoutMs ?? 120_000,
    })
  } else {
    const config = buildCliConfig(profile)
    adapter = new GenericCliAdapter(config)
  }

  adapterCache.set(id, adapter)
  return adapter
}
