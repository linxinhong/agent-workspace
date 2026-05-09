import { useWorkspace } from '../context/WorkspaceContext'

export function AgentSelector() {
  const { state, dispatch, loadAgents, loadAgentProfiles } = useWorkspace()

  const handleSelect = (id: string) => {
    dispatch({ type: 'SELECT_AGENT', agentId: id })
  }

  const agents = state.agents
  const profiles = state.agentProfiles ?? []

  if (agents.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto">
      <span className="text-xs text-gray-400 shrink-0 mr-1">Agent</span>
      {agents.map((agent) => {
        const isSelected = state.selectedAgentId === agent.id
        const isDisabled = !agent.detected
        const isApi = agent.kind === 'api'
        const profile = profiles.find(p => p.id === agent.id)
        const isAcp = profile?.kind === 'acp'

        let colorClass: string
        if (isApi) {
          colorClass = isSelected
            ? 'bg-blue-600 text-white'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
        } else if (isAcp) {
          colorClass = isSelected
            ? 'bg-purple-600 text-white'
            : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
        } else {
          colorClass = isSelected
            ? 'bg-emerald-600 text-white'
            : isDisabled
              ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
        }

        let title = agent.description ?? ''
        if (profile) {
          const parts: string[] = []
          if (profile.inputMode) parts.push(`input: ${profile.inputMode}`)
          if (profile.timeoutMs) parts.push(`timeout: ${(profile.timeoutMs / 1000).toFixed(0)}s`)
          if (isAcp && profile.acpEndpoint) parts.push(profile.acpEndpoint)
          if (parts.length) title = title ? `${title} (${parts.join(', ')})` : parts.join(', ')
        }
        if (isDisabled) title = `${agent.name} 未安装 — command: ${agent.command}`

        return (
          <button
            key={agent.id}
            onClick={() => !isDisabled && handleSelect(agent.id)}
            disabled={isDisabled}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${colorClass}`}
            title={title}
          >
            {agent.name}
            {agent.version && <span className="ml-1 opacity-60 text-[10px]">{agent.version}</span>}
            {isAcp && <span className="ml-1 opacity-60 text-[10px]">ACP</span>}
            {profile?.permissions?.requiresApproval && !isApi && (
              <span className="ml-1 opacity-60 text-[10px]" title="需要确认权限">&#128274;</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
