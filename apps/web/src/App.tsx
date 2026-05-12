import { useEffect, useState } from 'react'
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
import { ScheduledJobsPanel } from './components/ScheduledJobsPanel'
import { SkillDetail } from './components/SkillDetail'
import { PromptDebugger } from './components/PromptDebugger'
import { TemplatePicker, TemplateForm } from './components/TemplatePicker'
import { AgentSelector } from './components/AgentSelector'
import { ApprovalDialog } from './components/ApprovalDialog'
import { RunDetail } from './components/RunDetail'
import { NotificationBell } from './components/NotificationBell'

const LEFT_WIDTH_KEY = 'agent-workspace:leftPanelWidth'
const RIGHT_WIDTH_KEY = 'agent-workspace:rightPanelWidth'

function readStoredWidth(key: string, fallback: number) {
  const raw = localStorage.getItem(key)
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

function AppInner() {
  const { loadSkills, loadProjects, loadAgents, loadAgentProfiles, state, loadArtifactHistory, loadRunHistory, loadProjectFiles, confirmApproval, cancelApproval } = useWorkspace()
  const [leftWidth, setLeftWidth] = useState(() => readStoredWidth(LEFT_WIDTH_KEY, 256))
  const [rightWidth, setRightWidth] = useState(() => readStoredWidth(RIGHT_WIDTH_KEY, 520))
  const [mobileTab, setMobileTab] = useState<'files' | 'chat' | 'preview'>('chat')
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 767px)').matches)

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

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsNarrow(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const startResize = (side: 'left' | 'right') => (event: React.MouseEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const initial = side === 'left' ? leftWidth : rightWidth

    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      if (side === 'left') {
        const next = Math.min(420, Math.max(220, initial + delta))
        setLeftWidth(next)
        localStorage.setItem(LEFT_WIDTH_KEY, String(next))
      } else {
        const next = Math.min(760, Math.max(360, initial - delta))
        setRightWidth(next)
        localStorage.setItem(RIGHT_WIDTH_KEY, String(next))
      }
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const workspaceSidebar = (
    <aside className={`${isNarrow ? 'w-full' : ''} border-r flex flex-col bg-white shrink-0 min-h-0`} style={isNarrow ? undefined : { width: leftWidth }}>
      <ProjectOverview />
      <ProjectFiles />
      <ScheduledJobsPanel />
      <TemplatePicker />
      <div className="h-9 border-b border-t flex items-center px-4">
        <span className="text-xs font-medium text-gray-500">最近产物</span>
      </div>
      <RecentArtifacts />
      <div className="h-9 border-b border-t flex items-center px-4">
        <span className="text-xs font-medium text-gray-500">运行历史</span>
      </div>
      <RunHistory />
    </aside>
  )

  const chatPanel = (
    <div className="flex-1 min-w-0 flex flex-col bg-white border-r">
      <GoalInput />
      <AgentSelector />
      <SkillSelector />
      <ChatStream />
    </div>
  )

  const previewPanel = (
    <div className={`${isNarrow ? 'w-full' : ''} flex flex-col bg-white min-h-0`} style={isNarrow ? undefined : { width: rightWidth }}>
      <div className="h-10 border-b flex items-center px-4 shrink-0">
        <span className="text-sm font-medium text-gray-600">预览</span>
      </div>
      <ArtifactPreview />
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-14 border-b bg-white flex items-center px-6 shrink-0">
        <ProjectSwitcher />
        <div className="flex-1" />
        <NotificationBell />
      </header>
      <main className="flex-1 overflow-hidden">
        {isNarrow ? (
          <div className="h-full flex flex-col bg-white">
            <div className="h-10 border-b flex shrink-0">
              {[
                ['files', '文件'],
                ['chat', '会话'],
                ['preview', '预览'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setMobileTab(id as typeof mobileTab)}
                  className={`flex-1 text-sm font-medium ${mobileTab === id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0">
              {mobileTab === 'files' && <div className="h-full flex">{workspaceSidebar}</div>}
              {mobileTab === 'chat' && <div className="h-full flex">{chatPanel}</div>}
              {mobileTab === 'preview' && <div className="h-full flex">{previewPanel}</div>}
            </div>
          </div>
        ) : (
          <div className="h-full flex overflow-hidden">
            {workspaceSidebar}
            <div
              onMouseDown={startResize('left')}
              className="w-1 cursor-col-resize bg-transparent hover:bg-blue-200 shrink-0"
              aria-label="调整左栏宽度"
            />
            {chatPanel}
            <div
              onMouseDown={startResize('right')}
              className="w-1 cursor-col-resize bg-transparent hover:bg-blue-200 shrink-0"
              aria-label="调整预览栏宽度"
            />
            {previewPanel}
          </div>
        )}
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
