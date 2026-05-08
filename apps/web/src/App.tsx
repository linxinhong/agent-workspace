import { useEffect } from 'react'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import { GoalInput } from './components/GoalInput'
import { SkillSelector } from './components/SkillSelector'
import { ChatStream } from './components/ChatStream'
import { ArtifactPreview } from './components/ArtifactPreview'
import { RecentArtifacts } from './components/RecentArtifacts'
import { RunHistory } from './components/RunHistory'

function AppInner() {
  const { loadSkills, loadArtifactHistory, loadRunHistory } = useWorkspace()

  useEffect(() => {
    loadSkills()
    loadArtifactHistory()
    loadRunHistory()
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-14 border-b bg-white flex items-center px-6 shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">Agent Workspace</h1>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r flex flex-col bg-white shrink-0">
          <div className="h-10 border-b flex items-center px-4">
            <span className="text-sm font-medium text-gray-600">Recent Artifacts</span>
          </div>
          <RecentArtifacts />
          <div className="h-10 border-b border-t flex items-center px-4">
            <span className="text-sm font-medium text-gray-600">Run History</span>
          </div>
          <RunHistory />
        </aside>
        <div className="flex-1 min-w-0 flex flex-col bg-white border-r">
          <GoalInput />
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
