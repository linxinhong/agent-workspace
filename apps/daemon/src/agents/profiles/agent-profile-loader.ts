import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentProfile } from './agent-profile.types.js'
import { validateAgentProfile } from './validate-agent-profile.js'

let cachedProfiles: AgentProfile[] | null = null

// Resolve to monorepo root: apps/daemon/src/agents/profiles/ → ../../../../../ → project root
const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..', '..')
const DEFAULT_BASE = resolve(PROJECT_ROOT, 'agent-profiles')

export function loadProfiles(basePath?: string): AgentProfile[] {
  if (cachedProfiles) return cachedProfiles

  const dir = basePath ?? DEFAULT_BASE
  const profiles: AgentProfile[] = []

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      try {
        const raw = JSON.parse(readFileSync(join(dir, entry), 'utf-8'))
        const { valid, warnings } = validateAgentProfile(raw)
        if (!valid) {
          console.warn(`[profiles] Invalid profile ${entry}: ${warnings.join(', ')}`)
          continue
        }
        if (warnings.length > 0) {
          console.warn(`[profiles] Warnings in ${entry}: ${warnings.join(', ')}`)
        }
        profiles.push(raw as AgentProfile)
      } catch (err) {
        console.warn(`[profiles] Failed to load ${entry}: ${err instanceof Error ? err.message : err}`)
      }
    }
  } catch { /* directory doesn't exist yet */ }

  cachedProfiles = profiles
  return profiles
}

export function invalidateProfileCache(): void {
  cachedProfiles = null
}
