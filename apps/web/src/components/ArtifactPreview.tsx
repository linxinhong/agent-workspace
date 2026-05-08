import { useState } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { MarkdownRenderer } from './MarkdownRenderer'
import { HtmlSandbox } from './HtmlSandbox'
import { copyToClipboard, downloadArtifact } from '../utils/artifact-export'
import { createArtifactVersion, fetchArtifactVersions } from '../services/api'
import type { Artifact } from '@agent-workspace/contracts'

function ArtifactView({ artifact }: { artifact: Artifact }) {
  if (artifact.type === 'html') {
    return <HtmlSandbox content={artifact.content} />
  }

  if (artifact.type === 'markdown') {
    return <MarkdownRenderer content={artifact.content} />
  }

  return (
    <pre className="p-4 text-sm text-gray-800 whitespace-pre-wrap overflow-auto">
      {artifact.content}
    </pre>
  )
}

export function ArtifactPreview() {
  const { state, dispatch, refineArtifact, openArtifact } = useWorkspace()
  const [activeIndex, setActiveIndex] = useState(0)
  const [showRefine, setShowRefine] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [copied, setCopied] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editTab, setEditTab] = useState<'edit' | 'preview'>('edit')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editNote, setEditNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const current = state.activeArtifact
    ?? (state.artifacts.length > 0 ? state.artifacts[activeIndex] ?? state.artifacts[0] : null)

  if (!current) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Artifact 将在这里预览
      </div>
    )
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(current!.content)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const handleDownload = () => {
    downloadArtifact(current!)
  }

  const handleRefine = () => {
    if (!refineInput.trim() || state.isRunning) return
    refineArtifact(current!.id, refineInput)
    setRefineInput('')
    setShowRefine(false)
  }

  const handleStartEdit = () => {
    setEditTitle(current.title ?? '')
    setEditContent(current.content)
    setEditNote('')
    setEditTab('edit')
    setIsEditing(true)
    setShowRefine(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle('')
    setEditContent('')
    setEditNote('')
  }

  const handleSaveVersion = async () => {
    if (!editContent.trim() || isSaving) return
    setIsSaving(true)
    try {
      const newArtifact = await createArtifactVersion(current.id, {
        content: editContent,
        title: editTitle !== current.title ? editTitle : undefined,
        changeNote: editNote || undefined,
      })
      dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact: newArtifact })
      dispatch({ type: 'PREPEND_ARTIFACT_HISTORY', artifact: { id: newArtifact.id, type: newArtifact.type, title: newArtifact.title, createdAt: newArtifact.createdAt } })
      // Refresh version chain
      const chain = await fetchArtifactVersions(newArtifact.id)
      dispatch({ type: 'SET_VERSION_CHAIN', artifacts: chain })
      setIsEditing(false)
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setIsSaving(false)
    }
  }

  const versionChain = state.activeVersionChain
  const activeInChain = versionChain.length > 0
    ? versionChain.findIndex(v => v.id === current.id)
    : -1
  const versionNum = activeInChain >= 0 ? activeInChain + 1 : (current.version ?? 1)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="h-10 border-b flex items-center px-3 gap-2 shrink-0">
        <span className="text-sm font-medium text-gray-700 truncate">{current.title}</span>
        <span className="text-xs text-gray-400">&middot;</span>
        <span className="text-xs text-gray-400">{current.type}</span>
        <span className="text-xs text-gray-400">&middot;</span>
        <span className="text-xs text-gray-400">v{versionNum}</span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded hover:border-gray-300"
          >
            {copied ? '已复制' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded hover:border-gray-300"
          >
            Download
          </button>
          {!isEditing && !showRefine && (
            <button
              onClick={handleStartEdit}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 rounded hover:border-gray-300"
            >
              Edit
            </button>
          )}
          {!isEditing && !showRefine && (
            <button
              onClick={() => setShowRefine(true)}
              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:border-blue-300"
            >
              Refine
            </button>
          )}
          {state.activeArtifact && (
            <button
              onClick={() => dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact: null })}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Version chain */}
      {versionChain.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b overflow-x-auto">
          {versionChain.map((v, i) => (
            <span key={v.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300 text-xs">&rarr;</span>}
              <button
                onClick={() => openArtifact(v.id)}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  v.id === current.id
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                v{i + 1}
              </button>
            </span>
          ))}
        </div>
      )}

      {!state.activeArtifact && state.artifacts.length > 1 && (
        <div className="flex gap-1 px-3 py-2 border-b">
          {state.artifacts.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setActiveIndex(i)}
              className={`px-2 py-1 rounded text-xs font-medium ${
                i === activeIndex
                  ? 'bg-gray-200 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {a.title}
            </button>
          ))}
        </div>
      )}

      {/* Edit mode */}
      {isEditing ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => setEditTab('edit')}
              className={`px-4 py-1.5 text-xs font-medium ${editTab === 'edit' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            >
              Edit
            </button>
            <button
              onClick={() => setEditTab('preview')}
              className={`px-4 py-1.5 text-xs font-medium ${editTab === 'preview' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            >
              Preview
            </button>
          </div>

          {editTab === 'edit' ? (
            <div className="flex-1 flex flex-col overflow-hidden p-3 gap-2">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Title"
                className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="flex-1 text-sm font-mono border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-0"
                spellCheck={false}
              />
              <input
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                placeholder="Change note (optional)"
                className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <ArtifactView artifact={{ ...current, content: editContent, title: editTitle }} />
            </div>
          )}

          <div className="border-t px-3 py-2 flex gap-2">
            <button
              onClick={handleSaveVersion}
              disabled={isSaving || !editContent.trim()}
              className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save as New Version'}
            </button>
            <button
              onClick={handleCancelEdit}
              className="text-sm px-3 py-1 text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Preview mode */}
          <div className="flex-1 overflow-hidden">
            <ArtifactView artifact={current} />
          </div>

          {/* Refine input */}
          {showRefine && (
            <div className="border-t px-3 py-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                  placeholder="输入修改要求..."
                  disabled={state.isRunning}
                  className="flex-1 text-sm rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleRefine}
                  disabled={state.isRunning || !refineInput.trim()}
                  className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  修改
                </button>
                <button
                  onClick={() => { setShowRefine(false); setRefineInput('') }}
                  className="text-sm px-2 py-1 text-gray-500 hover:text-gray-700"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
