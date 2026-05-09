import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { AgentDescriptor, Artifact, ArtifactSummary, ArtifactTemplate, Project, SkillDetail, WorkspaceFile } from '@agent-workspace/contracts'
import {
  fetchSkills, fetchArtifact, fetchArtifactSummaries, fetchRuns, fetchArtifactVersions,
  runAgentStream, refineArtifactStream, fetchProjects, createProject, deleteProject, fetchProjectDetail,
  fetchProjectFiles, fetchSkillDetail, reloadSkills as reloadSkillsApi, fetchDebugPrompt,
  fetchTemplates as fetchTemplatesApi, fetchTemplateDetail, renderTemplate,
  fetchAgents, fetchRunDetail, cancelRun as cancelRunApi,
  fetchAgentProfiles,
  type RunEvent, type RunSummary, type RunDetail, type SkillBrief, type ProjectDetail, type TemplateBrief, type AgentProfileInfo, type AgentPermissions,
} from '../services/api'

const LAST_PROJECT_KEY = 'agent-workspace:lastProjectId'

interface ChatMessage { role: 'assistant'; content: string }

interface State {
  skills: SkillBrief[]
  selectedSkillId: string | null
  goal: string
  messages: ChatMessage[]
  artifacts: Artifact[]
  isRunning: boolean
  error: string | null
  artifactHistory: ArtifactSummary[]
  activeArtifact: Artifact | null
  activeVersionChain: Artifact[]
  runHistory: RunSummary[]
  projects: Project[]
  currentProjectId: string | null
  currentProjectDetail: ProjectDetail | null
  projectFiles: WorkspaceFile[]
  selectedFileIds: string[]
  activeSkillDetail: SkillDetail | null
  debugMessages: Array<{ role: string; content: string }> | null
  templates: TemplateBrief[]
  activeTemplate: ArtifactTemplate | null
  agents: AgentDescriptor[]
  agentProfiles: AgentProfileInfo[]
  selectedAgentId: string
  activeRunDetail: RunDetail | null
  currentRunId: string | null
  pendingApproval: { agentName: string; permissions: AgentPermissions; permissionsHash: string } | null
}

type Action =
  | { type: 'SET_SKILLS'; skills: SkillBrief[] }
  | { type: 'SELECT_SKILL'; skillId: string | null }
  | { type: 'SET_GOAL'; goal: string }
  | { type: 'START_RUN' }
  | { type: 'APPEND_DELTA'; content: string }
  | { type: 'ADD_ARTIFACT'; artifact: Artifact }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'FINISH_RUN' }
  | { type: 'RESET' }
  | { type: 'SET_ARTIFACT_HISTORY'; artifacts: ArtifactSummary[] }
  | { type: 'SET_ACTIVE_ARTIFACT'; artifact: Artifact | null }
  | { type: 'PREPEND_ARTIFACT_HISTORY'; artifact: ArtifactSummary }
  | { type: 'SET_RUN_HISTORY'; runs: RunSummary[] }
  | { type: 'SET_VERSION_CHAIN'; artifacts: Artifact[] }
  | { type: 'SET_PROJECTS'; projects: Project[] }
  | { type: 'SET_CURRENT_PROJECT'; projectId: string }
  | { type: 'SET_PROJECT_DETAIL'; detail: ProjectDetail | null }
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'SET_PROJECT_FILES'; files: WorkspaceFile[] }
  | { type: 'ADD_FILE'; file: WorkspaceFile }
  | { type: 'REMOVE_FILE'; fileId: string }
  | { type: 'TOGGLE_FILE_SELECTION'; fileId: string }
  | { type: 'CLEAR_FILE_SELECTION' }
  | { type: 'SET_ACTIVE_SKILL_DETAIL'; detail: SkillDetail | null }
  | { type: 'SET_DEBUG_MESSAGES'; messages: Array<{ role: string; content: string }> | null }
  | { type: 'SET_TEMPLATES'; templates: TemplateBrief[] }
  | { type: 'SET_ACTIVE_TEMPLATE'; template: ArtifactTemplate | null }
  | { type: 'SET_AGENTS'; agents: AgentDescriptor[] }
  | { type: 'SET_AGENT_PROFILES'; profiles: AgentProfileInfo[] }
  | { type: 'SELECT_AGENT'; agentId: string }
  | { type: 'SET_ACTIVE_RUN_DETAIL'; detail: RunDetail | null }
  | { type: 'SET_CURRENT_RUN_ID'; runId: string | null }
  | { type: 'SHOW_APPROVAL'; info: { agentName: string; permissions: AgentPermissions; permissionsHash: string } }
  | { type: 'CLEAR_APPROVAL' }

const initialState: State = {
  skills: [], selectedSkillId: null, goal: '', messages: [], artifacts: [],
  isRunning: false, error: null, artifactHistory: [], activeArtifact: null,
  activeVersionChain: [], runHistory: [], projects: [], currentProjectId: null,
  currentProjectDetail: null,
  projectFiles: [],
  selectedFileIds: [],
  activeSkillDetail: null,
  debugMessages: null,
  templates: [],
  activeTemplate: null,
  agents: [],
  agentProfiles: [],
  selectedAgentId: 'api-default',
  activeRunDetail: null,
  currentRunId: null,
  pendingApproval: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SKILLS': return { ...state, skills: action.skills }
    case 'SELECT_SKILL': return { ...state, selectedSkillId: action.skillId }
    case 'SET_GOAL': return { ...state, goal: action.goal }
    case 'START_RUN': return { ...state, isRunning: true, messages: [], artifacts: [], activeArtifact: null, error: null }
    case 'APPEND_DELTA': return {
      ...state,
      messages: state.messages.length > 0
        ? [...state.messages.slice(0, -1), { ...state.messages[state.messages.length - 1], content: state.messages[state.messages.length - 1].content + action.content }]
        : [{ role: 'assistant', content: action.content }],
    }
    case 'ADD_ARTIFACT': return { ...state, artifacts: [...state.artifacts, action.artifact] }
    case 'SET_ERROR': return { ...state, error: action.error, isRunning: false }
    case 'FINISH_RUN': return { ...state, isRunning: false }
    case 'RESET': return { ...initialState, skills: state.skills, projects: state.projects, currentProjectId: state.currentProjectId }
    case 'SET_ARTIFACT_HISTORY': return { ...state, artifactHistory: action.artifacts }
    case 'SET_ACTIVE_ARTIFACT': return { ...state, activeArtifact: action.artifact }
    case 'PREPEND_ARTIFACT_HISTORY': {
      const exists = state.artifactHistory.some(a => a.id === action.artifact.id)
      if (exists) return state
      return { ...state, artifactHistory: [action.artifact, ...state.artifactHistory] }
    }
    case 'SET_RUN_HISTORY': return { ...state, runHistory: action.runs }
    case 'SET_VERSION_CHAIN': return { ...state, activeVersionChain: action.artifacts }
    case 'SET_PROJECTS': return { ...state, projects: action.projects }
    case 'SET_CURRENT_PROJECT': {
      localStorage.setItem(LAST_PROJECT_KEY, action.projectId)
      return { ...state, currentProjectId: action.projectId, currentProjectDetail: null }
    }
    case 'SET_PROJECT_DETAIL': return { ...state, currentProjectDetail: action.detail }
    case 'ADD_PROJECT': return { ...state, projects: [action.project, ...state.projects] }
    case 'SET_PROJECT_FILES': return { ...state, projectFiles: action.files }
    case 'ADD_FILE': return { ...state, projectFiles: [action.file, ...state.projectFiles] }
    case 'REMOVE_FILE': return { ...state, projectFiles: state.projectFiles.filter(f => f.id !== action.fileId), selectedFileIds: state.selectedFileIds.filter(id => id !== action.fileId) }
    case 'TOGGLE_FILE_SELECTION': {
      const ids = state.selectedFileIds.includes(action.fileId)
        ? state.selectedFileIds.filter(id => id !== action.fileId)
        : [...state.selectedFileIds, action.fileId]
      return { ...state, selectedFileIds: ids }
    }
    case 'CLEAR_FILE_SELECTION': return { ...state, selectedFileIds: [] }
    case 'SET_ACTIVE_SKILL_DETAIL': return { ...state, activeSkillDetail: action.detail }
    case 'SET_DEBUG_MESSAGES': return { ...state, debugMessages: action.messages }
    case 'SET_TEMPLATES': return { ...state, templates: action.templates }
    case 'SET_ACTIVE_TEMPLATE': return { ...state, activeTemplate: action.template }
    case 'SET_AGENTS': return { ...state, agents: action.agents }
    case 'SET_AGENT_PROFILES': return { ...state, agentProfiles: action.profiles }
    case 'SELECT_AGENT': return { ...state, selectedAgentId: action.agentId }
    case 'SET_ACTIVE_RUN_DETAIL': return { ...state, activeRunDetail: action.detail }
    case 'SET_CURRENT_RUN_ID': return { ...state, currentRunId: action.runId }
    case 'SHOW_APPROVAL': return { ...state, pendingApproval: action.info }
    case 'CLEAR_APPROVAL': return { ...state, pendingApproval: null }
  }
}

interface WorkspaceContextValue {
  state: State
  dispatch: React.Dispatch<Action>
  loadSkills: () => Promise<void>
  loadArtifactHistory: () => Promise<void>
  loadRunHistory: () => Promise<void>
  openArtifact: (id: string) => Promise<void>
  loadVersionChain: (id: string) => Promise<void>
  runAgent: () => Promise<void>
  refineArtifact: (artifactId: string, instruction: string, skillId?: string) => Promise<void>
  loadProjects: () => Promise<void>
  loadProjectFiles: () => Promise<void>
  switchProject: (id: string) => Promise<void>
  createNewProject: (name: string, description?: string) => Promise<void>
  removeProject: (id: string) => Promise<void>
  loadSkillDetail: (id: string) => Promise<void>
  reloadSkills: () => Promise<void>
  debugPrompt: (goal: string) => Promise<void>
  loadTemplates: () => Promise<void>
  openTemplate: (id: string) => Promise<void>
  createFromTemplate: (id: string, variables: Record<string, string>) => Promise<void>
  runWithTemplate: (id: string, variables: Record<string, string>, goal: string) => Promise<void>
  loadAgents: () => Promise<void>
  loadAgentProfiles: () => Promise<void>
  openRunDetail: (id: string) => Promise<void>
  closeRunDetail: () => void
  cancelCurrentRun: () => Promise<void>
  confirmApproval: () => void
  cancelApproval: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const loadSkills = async () => {
    const skills = await fetchSkills()
    dispatch({ type: 'SET_SKILLS', skills })
  }

  const loadArtifactHistory = async () => {
    const arts = await fetchArtifactSummaries({ projectId: state.currentProjectId ?? undefined })
    dispatch({ type: 'SET_ARTIFACT_HISTORY', artifacts: arts })
  }

  const loadRunHistory = async () => {
    const runs = await fetchRuns({ projectId: state.currentProjectId ?? undefined })
    dispatch({ type: 'SET_RUN_HISTORY', runs })
  }

  const openArtifact = async (id: string) => {
    const artifact = await fetchArtifact(id)
    dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact })
    fetchArtifactVersions(id).then(chain => dispatch({ type: 'SET_VERSION_CHAIN', artifacts: chain }))
  }

  const loadVersionChain = async (id: string) => {
    const chain = await fetchArtifactVersions(id)
    dispatch({ type: 'SET_VERSION_CHAIN', artifacts: chain })
  }

  const runAgent = async (approval?: { approved: boolean; permissionsHash: string }) => {
    if (!state.goal.trim()) return

    // Check if approval is needed
    if (state.selectedAgentId !== 'api-default' && !approval) {
      const profile = state.agentProfiles.find(p => p.id === state.selectedAgentId)
      if (profile?.permissions?.requiresApproval && profile.permissionsHash) {
        dispatch({ type: 'SHOW_APPROVAL', info: { agentName: profile.name, permissions: profile.permissions, permissionsHash: profile.permissionsHash } })
        return
      }
    }

    dispatch({ type: 'START_RUN' })

    try {
      await runAgentStream({
        goal: state.goal,
        skillId: state.selectedSkillId ?? undefined,
        projectId: state.currentProjectId ?? undefined,
        fileIds: state.selectedFileIds.length > 0 ? state.selectedFileIds : undefined,
        agentId: state.selectedAgentId !== 'api-default' ? state.selectedAgentId : undefined,
        approval,
        onEvent: (event: RunEvent) => {
          switch (event.type) {
            case 'start':
              dispatch({ type: 'SET_CURRENT_RUN_ID', runId: event.data.goalId as string })
              break
            case 'delta':
              dispatch({ type: 'APPEND_DELTA', content: event.data.content as string })
              break
            case 'artifact': {
              const aid = event.data.id as string
              fetchArtifact(aid).then((full) => {
                dispatch({ type: 'ADD_ARTIFACT', artifact: full })
                dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact: full })
                dispatch({ type: 'PREPEND_ARTIFACT_HISTORY', artifact: { id: full.id, type: full.type, title: full.title, createdAt: full.createdAt } })
              })
              break
            }
            case 'error':
              dispatch({ type: 'SET_ERROR', error: event.data.error as string })
              break
            case 'done':
              dispatch({ type: 'FINISH_RUN' })
              dispatch({ type: 'SET_CURRENT_RUN_ID', runId: null })
              loadArtifactHistory()
              loadRunHistory()
              break
          }
        },
      })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const refineArtifact = async (artifactId: string, instruction: string, skillId?: string) => {
    dispatch({ type: 'START_RUN' })
    try {
      await refineArtifactStream({
        artifactId, instruction, skillId,
        fileIds: state.selectedFileIds.length > 0 ? state.selectedFileIds : undefined,
        onEvent: (event: RunEvent) => {
          switch (event.type) {
            case 'delta':
              dispatch({ type: 'APPEND_DELTA', content: event.data.content as string })
              break
            case 'artifact': {
              const aid = event.data.id as string
              fetchArtifact(aid).then((full) => {
                dispatch({ type: 'ADD_ARTIFACT', artifact: full })
                dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact: full })
                dispatch({ type: 'PREPEND_ARTIFACT_HISTORY', artifact: { id: full.id, type: full.type, title: full.title, createdAt: full.createdAt } })
                fetchArtifactVersions(aid).then(chain => dispatch({ type: 'SET_VERSION_CHAIN', artifacts: chain }))
              })
              break
            }
            case 'error':
              dispatch({ type: 'SET_ERROR', error: event.data.error as string })
              break
            case 'done':
              dispatch({ type: 'FINISH_RUN' })
              loadArtifactHistory()
              loadRunHistory()
              break
          }
        },
      })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const loadProjectFiles = async () => {
    if (!state.currentProjectId) return
    const files = await fetchProjectFiles(state.currentProjectId)
    dispatch({ type: 'SET_PROJECT_FILES', files })
  }

  const loadProjects = async () => {
    const projects = await fetchProjects()
    dispatch({ type: 'SET_PROJECTS', projects })

    const lastId = localStorage.getItem(LAST_PROJECT_KEY)
    const targetId = lastId && projects.some(p => p.id === lastId) ? lastId : projects[0]?.id
    if (targetId) {
      dispatch({ type: 'SET_CURRENT_PROJECT', projectId: targetId })
    }
  }

  const switchProject = async (id: string) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', projectId: id })
    fetchProjectDetail(id).then(d => dispatch({ type: 'SET_PROJECT_DETAIL', detail: d }))
  }

  const createNewProject = async (name: string, description?: string) => {
    const project = await createProject(name, description)
    dispatch({ type: 'ADD_PROJECT', project })
    dispatch({ type: 'SET_CURRENT_PROJECT', projectId: project.id })
  }

  const removeProject = async (id: string) => {
    await deleteProject(id)
    const projects = await fetchProjects()
    dispatch({ type: 'SET_PROJECTS', projects })
    if (state.currentProjectId === id && projects.length > 0) {
      dispatch({ type: 'SET_CURRENT_PROJECT', projectId: projects[0].id })
    }
  }

  const loadSkillDetail = async (id: string) => {
    const detail = await fetchSkillDetail(id)
    dispatch({ type: 'SET_ACTIVE_SKILL_DETAIL', detail })
  }

  const reloadSkillsFn = async () => {
    await reloadSkillsApi()
    const skills = await fetchSkills()
    dispatch({ type: 'SET_SKILLS', skills })
    dispatch({ type: 'SET_ACTIVE_SKILL_DETAIL', detail: null })
  }

  const debugPrompt = async (goal: string) => {
    const result = await fetchDebugPrompt({
      goal,
      skillId: state.selectedSkillId ?? undefined,
      projectId: state.currentProjectId ?? undefined,
      fileIds: state.selectedFileIds.length > 0 ? state.selectedFileIds : undefined,
    })
    dispatch({ type: 'SET_DEBUG_MESSAGES', messages: result.messages })
  }

  const loadTemplatesFn = async () => {
    const templates = await fetchTemplatesApi()
    dispatch({ type: 'SET_TEMPLATES', templates })
  }

  const openTemplate = async (id: string) => {
    const template = await fetchTemplateDetail(id)
    dispatch({ type: 'SET_ACTIVE_TEMPLATE', template })
  }

  const createFromTemplate = async (id: string, variables: Record<string, string>) => {
    const rendered = await renderTemplate(id, variables)
    const artifact: Artifact = {
      id: crypto.randomUUID(),
      type: rendered.type as Artifact['type'],
      title: rendered.title,
      content: rendered.content,
      createdAt: new Date().toISOString(),
    }
    dispatch({ type: 'ADD_ARTIFACT', artifact })
    dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact })
    dispatch({ type: 'PREPEND_ARTIFACT_HISTORY', artifact: { id: artifact.id, type: artifact.type, title: artifact.title, createdAt: artifact.createdAt } })
    dispatch({ type: 'SET_ACTIVE_TEMPLATE', template: null })
  }

  const runWithTemplate = async (id: string, variables: Record<string, string>, goal: string) => {
    dispatch({ type: 'START_RUN' })
    dispatch({ type: 'SET_ACTIVE_TEMPLATE', template: null })
    try {
      await runAgentStream({
        goal,
        skillId: state.selectedSkillId ?? undefined,
        projectId: state.currentProjectId ?? undefined,
        fileIds: state.selectedFileIds.length > 0 ? state.selectedFileIds : undefined,
        templateId: id,
        templateVariables: variables,
        agentId: state.selectedAgentId !== 'api-default' ? state.selectedAgentId : undefined,
        onEvent: (event: RunEvent) => {
          switch (event.type) {
            case 'delta':
              dispatch({ type: 'APPEND_DELTA', content: event.data.content as string })
              break
            case 'artifact': {
              const aid = event.data.id as string
              fetchArtifact(aid).then((full) => {
                dispatch({ type: 'ADD_ARTIFACT', artifact: full })
                dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact: full })
                dispatch({ type: 'PREPEND_ARTIFACT_HISTORY', artifact: { id: full.id, type: full.type, title: full.title, createdAt: full.createdAt } })
              })
              break
            }
            case 'error':
              dispatch({ type: 'SET_ERROR', error: event.data.error as string })
              break
            case 'done':
              dispatch({ type: 'FINISH_RUN' })
              loadArtifactHistory()
              loadRunHistory()
              break
          }
        },
      })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const loadAgentsFn = async () => {
    const agents = await fetchAgents()
    dispatch({ type: 'SET_AGENTS', agents })
  }

  const loadAgentProfilesFn = async () => {
    const profiles = await fetchAgentProfiles()
    dispatch({ type: 'SET_AGENT_PROFILES', profiles })
  }

  const openRunDetail = async (id: string) => {
    const detail = await fetchRunDetail(id)
    dispatch({ type: 'SET_ACTIVE_RUN_DETAIL', detail })
  }

  const closeRunDetail = () => {
    dispatch({ type: 'SET_ACTIVE_RUN_DETAIL', detail: null })
  }

  const cancelCurrentRun = async () => {
    if (!state.currentRunId) return
    try {
      await cancelRunApi(state.currentRunId)
      dispatch({ type: 'FINISH_RUN' })
      dispatch({ type: 'SET_CURRENT_RUN_ID', runId: null })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Cancel failed' })
    }
  }

  const confirmApproval = () => {
    const info = state.pendingApproval
    if (!info) return
    dispatch({ type: 'CLEAR_APPROVAL' })
    runAgent({ approved: true, permissionsHash: info.permissionsHash })
  }

  const cancelApproval = () => {
    dispatch({ type: 'CLEAR_APPROVAL' })
  }

  return (
    <WorkspaceContext.Provider value={{
      state, dispatch, loadSkills, loadArtifactHistory, loadRunHistory,
      openArtifact, loadVersionChain, runAgent, refineArtifact,
      loadProjects, loadProjectFiles, switchProject, createNewProject, removeProject,
      loadSkillDetail, reloadSkills: reloadSkillsFn, debugPrompt,
      loadTemplates: loadTemplatesFn, openTemplate, createFromTemplate, runWithTemplate,
      loadAgents: loadAgentsFn,
      loadAgentProfiles: loadAgentProfilesFn,
      openRunDetail, closeRunDetail, cancelCurrentRun,
      confirmApproval, cancelApproval,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
