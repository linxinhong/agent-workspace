import { useEffect } from 'react'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import { GoalInput } from './components/GoalInput'
import { SkillSelector } from './components/SkillSelector'
import { ChatStream } from './components/ChatStream'
import { ArtifactPreview } from './components/ArtifactPreview'
import { RecentArtifacts } from './components/RecentArtifacts'
import { RunHistory } from './components/RunHistory'
import { ProjectSwitcher } from './components/ProjectSwitcher'
import { ProjectOverview } from './components/ProjectOverview'
import { ProjectFiles } from './components/ProjectFiles'
import { SkillDetail } from './components/SkillDetail'
import { PromptDebugger } from './components/PromptDebugger'
import { TemplatePicker, TemplateForm } from './components/TemplatePicker'
import { AgentSelector } from './components/AgentSelector'
import { ApprovalDialog } from './components/ApprovalDialog'
import { RunDetail } from './components/RunDetail'

function AppInner() {
  const { loadSkills, loadProjects, loadAgents, loadAgentProfiles, state, loadArtifactHistory, loadRunHistory, loadProjectFiles, confirmApproval, cancelApproval } = useWorkspace()

  useEffect(() => {
    loadSkills()
    loadProjects()
    loadAgents()
    loadAgentProfiles()
  }, [])

  useEffect(() => {
    if (state.currentProjectId) {
      loadArtifactHistory()
      loadRunHistory()
      loadProjectFiles()
    }
  }, [state.currentProjectId])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-14 border-b bg-white flex items-center px-6 shrink-0">
        <ProjectSwitcher />
      </header>
      <main className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r flex flex-col bg-white shrink-0">
          <ProjectOverview />
          <ProjectFiles />
          <TemplatePicker />
          <div className="h-9 border-b border-t flex items-center px-4">
            <span className="text-xs font-medium text-gray-500">Recent Artifacts</span>
          </div>
          <RecentArtifacts />
          <div className="h-9 border-b border-t flex items-center px-4">
            <span className="text-xs font-medium text-gray-500">Run History</span>
          </div>
          <RunHistory />
        </aside>
        <div className="flex-1 min-w-0 flex flex-col bg-white border-r">
          <GoalInput />
          <AgentSelector />
          <SkillSelector />
          <ChatStream />
        </div>
        <div className="w-2/5 flex flex-col bg-white">
          <div className="h-10 border-b flex items-center px-4">
            <span className="text-sm font-medium text-gray-600">Preview</span>
          </div>
          <ArtifactPreview />
        </div>
      </main>
      <SkillDetail />
      <PromptDebugger />
      <TemplateForm />
      <RunDetail />
      {state.pendingApproval && (
        <ApprovalDialog
          agentName={state.pendingApproval.agentName}
          permissions={state.pendingApproval.permissions}
          permissionsHash={state.pendingApproval.permissionsHash}
          onConfirm={confirmApproval}
          onCancel={cancelApproval}
        />
      )}
    </div>
  )
}

export function App() {
  return (
    <WorkspaceProvider>
      <AppInner />
    </WorkspaceProvider>
  )
}
