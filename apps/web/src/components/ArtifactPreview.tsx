import { useState } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { copyToClipboard, downloadArtifact } from '../utils/artifact-export'
import { createArtifactVersion, fetchArtifactVersions } from '../services/api'
import { ArtifactEditor } from './artifact/ArtifactEditor'
import { ArtifactRefineBox } from './artifact/ArtifactRefineBox'
import { ArtifactToolbar } from './artifact/ArtifactToolbar'
import { ArtifactVersionBar } from './artifact/ArtifactVersionBar'
import { ArtifactViewer } from './artifact/ArtifactViewer'

export function ArtifactPreview() {
  const { state, dispatch, refineArtifact, openArtifact: rawOpenArtifact, loadArtifactHistory } = useWorkspace()
  const [activeIndex, setActiveIndex] = useState(0)
  const [showRefine, setShowRefine] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)

  const current = state.activeArtifact
    ?? (state.artifacts.length > 0 ? state.artifacts[activeIndex] ?? state.artifacts[0] : null)

  if (!current) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Artifact 将在这里预览
      </div>
    )
  }

  const versionChain = state.activeVersionChain
  const activeInChain = versionChain.length > 0
    ? versionChain.findIndex(v => v.id === current.id)
    : -1
  const versionNum = activeInChain >= 0 ? activeInChain + 1 : (current.version ?? 1)

  const openArtifact = (id: string) => {
    if (editorDirty && !window.confirm('有未保存的修改，确认离开？')) return
    setIsEditing(false)
    setEditorDirty(false)
    rawOpenArtifact(id)
  }

  const selectGeneratedArtifact = (index: number) => {
    if (editorDirty && !window.confirm('有未保存的修改，确认离开？')) return
    setIsEditing(false)
    setEditorDirty(false)
    setActiveIndex(index)
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(current.content)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  const handleRefine = () => {
    if (!refineInput.trim() || state.isRunning) return
    refineArtifact(current.id, refineInput)
    setRefineInput('')
    setShowRefine(false)
  }

  const handleSaveVersion = async (data: {
    content: string
    title?: string
    changeNote?: string
    source?: string
  }) => {
    const newArtifact = await createArtifactVersion(current.id, data)
    dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact: newArtifact })
    dispatch({
      type: 'PREPEND_ARTIFACT_HISTORY',
      artifact: {
        id: newArtifact.id,
        type: newArtifact.type,
        title: newArtifact.title,
        createdAt: newArtifact.createdAt,
      },
    })
    const chain = await fetchArtifactVersions(newArtifact.id)
    dispatch({ type: 'SET_VERSION_CHAIN', artifacts: chain })
    await loadArtifactHistory()
    setIsEditing(false)
    setEditorDirty(false)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ArtifactToolbar
        artifact={current}
        versionNum={versionNum}
        isDirty={editorDirty}
        copied={copied}
        isEditing={isEditing}
        showRefine={showRefine}
        onCopy={handleCopy}
        onDownload={() => downloadArtifact(current)}
        onEdit={() => { setIsEditing(true); setEditorDirty(false); setShowRefine(false) }}
        onRefine={() => setShowRefine(true)}
        onClose={state.activeArtifact ? () => {
          if (editorDirty && !window.confirm('有未保存的修改，确认关闭？')) return
          setIsEditing(false)
          setEditorDirty(false)
          dispatch({ type: 'SET_ACTIVE_ARTIFACT', artifact: null })
        } : undefined}
      />

      <ArtifactVersionBar
        currentId={current.id}
        versionChain={versionChain}
        generatedArtifacts={state.artifacts}
        activeIndex={activeIndex}
        hasActiveArtifact={!!state.activeArtifact}
        onOpenVersion={openArtifact}
        onSelectGenerated={selectGeneratedArtifact}
      />

      {isEditing ? (
        <ArtifactEditor
          key={current.id}
          artifact={current}
          onSave={handleSaveVersion}
          onCancel={() => { setIsEditing(false); setEditorDirty(false) }}
          onDirtyChange={setEditorDirty}
        />
      ) : (
        <>
          <div className="flex-1 overflow-hidden">
            <ArtifactViewer artifact={current} />
          </div>
          {showRefine && (
            <ArtifactRefineBox
              value={refineInput}
              isRunning={state.isRunning}
              onChange={setRefineInput}
              onSubmit={handleRefine}
              onCancel={() => { setShowRefine(false); setRefineInput('') }}
            />
          )}
        </>
      )}
    </div>
  )
}
