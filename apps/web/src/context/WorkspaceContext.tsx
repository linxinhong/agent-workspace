import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { Artifact, ArtifactSummary } from '@agent-workspace/contracts'
import { fetchSkills, fetchArtifact, fetchArtifactSummaries, fetchRuns, fetchArtifactVersions, runAgentStream, refineArtifactStream, type RunEvent, type RunSummary, type SkillBrief } from '../services/api'

interface ChatMessage {
  role: 'assistant'
  content: string
}

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

const initialState: State = {
  skills: [],
  selectedSkillId: null,
  goal: '',
  messages: [],
  artifacts: [],
  isRunning: false,
  error: null,
  artifactHistory: [],
  activeArtifact: null,
  activeVersionChain: [],
  runHistory: [],
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SKILLS':
      return { ...state, skills: action.skills }
    case 'SELECT_SKILL':
      return { ...state, selectedSkillId: action.skillId }
    case 'SET_GOAL':
      return { ...state, goal: action.goal }
    case 'START_RUN':
      return { ...state, isRunning: true, messages: [], artifacts: [], activeArtifact: null, error: null }
    case 'APPEND_DELTA':
      return {
        ...state,
        messages: state.messages.length > 0
          ? [
              ...state.messages.slice(0, -1),
              { ...state.messages[state.messages.length - 1], content: state.messages[state.messages.length - 1].content + action.content },
            ]
          : [{ role: 'assistant', content: action.content }],
      }
    case 'ADD_ARTIFACT':
      return { ...state, artifacts: [...state.artifacts, action.artifact] }
    case 'SET_ERROR':
      return { ...state, error: action.error, isRunning: false }
    case 'FINISH_RUN':
      return { ...state, isRunning: false }
    case 'RESET':
      return { ...initialState, skills: state.skills, artifactHistory: state.artifactHistory }
    case 'SET_ARTIFACT_HISTORY':
      return { ...state, artifactHistory: action.artifacts }
    case 'SET_ACTIVE_ARTIFACT':
      return { ...state, activeArtifact: action.artifact }
    case 'PREPEND_ARTIFACT_HISTORY': {
      const exists = state.artifactHistory.some(a => a.id === action.artifact.id)
      if (exists) return state
      return { ...state, artifactHistory: [action.artifact, ...state.artifactHistory] }
    }
    case 'SET_RUN_HISTORY':
      return { ...state, runHistory: action.runs }
    case 'SET_VERSION_CHAIN':
      return { ...state, activeVersionChain: action.artifacts }
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
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const loadSkills = async () => {
    const skills = await fetchSkills()
    dispatch({ type: 'SET_SKILLS', skills })
  }

  const loadArtifactHistory = async () => {
    const artifacts = await fetchArtifactSummaries()
    dispatch({ type: 'SET_ARTIFACT_HISTORY', artifacts })
  }

  const loadRunHistory = async () => {
    const runs = await fetchRuns()
    dispatch({ type: 'SET_RUN_HISTORY', runs })
  }

  const openArtifact = async (id: string) => {
    const artifact = await fetchArtifact(id)
    dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact })
    fetchArtifactVersions(id).then(chain => {
      dispatch({ type: 'SET_VERSION_CHAIN', artifacts: chain })
    })
  }

  const loadVersionChain = async (id: string) => {
    const chain = await fetchArtifactVersions(id)
    dispatch({ type: 'SET_VERSION_CHAIN', artifacts: chain })
  }

  const refineArtifact = async (artifactId: string, instruction: string, skillId?: string) => {
    dispatch({ type: 'START_RUN' })

    try {
      await refineArtifactStream({
        artifactId,
        instruction,
        skillId,
        onEvent: (event: RunEvent) => {
          switch (event.type) {
            case 'delta':
              dispatch({ type: 'APPEND_DELTA', content: event.data.content as string })
              break
            case 'artifact': {
              const id = event.data.id as string
              fetchArtifact(id).then((full) => {
                dispatch({ type: 'ADD_ARTIFACT', artifact: full })
                dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact: full })
                dispatch({
                  type: 'PREPEND_ARTIFACT_HISTORY',
                  artifact: { id: full.id, type: full.type, title: full.title, createdAt: full.createdAt },
                })
                fetchArtifactVersions(id).then(chain => {
                  dispatch({ type: 'SET_VERSION_CHAIN', artifacts: chain })
                })
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

  const runAgent = async () => {
    if (!state.goal.trim()) return

    dispatch({ type: 'START_RUN' })

    try {
      await runAgentStream({
        goal: state.goal,
        skillId: state.selectedSkillId ?? undefined,
        onEvent: (event: RunEvent) => {
          switch (event.type) {
            case 'delta':
              dispatch({ type: 'APPEND_DELTA', content: event.data.content as string })
              break
            case 'artifact': {
              const artifactId = event.data.id as string
              fetchArtifact(artifactId).then((full) => {
                dispatch({ type: 'ADD_ARTIFACT', artifact: full })
                dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact: full })
                dispatch({
                  type: 'PREPEND_ARTIFACT_HISTORY',
                  artifact: {
                    id: full.id,
                    type: full.type,
                    title: full.title,
                    createdAt: full.createdAt,
                  },
                })
              })
              break
            }
            case 'error':
              dispatch({ type: 'SET_ERROR', error: event.data.error as string })
              break
            case 'done':
              dispatch({ type: 'FINISH_RUN' })
              break
          }
        },
      })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return (
    <WorkspaceContext.Provider value={{ state, dispatch, loadSkills, loadArtifactHistory, loadRunHistory, openArtifact, loadVersionChain, runAgent, refineArtifact }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
