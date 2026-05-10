import { useEffect, useRef, useState } from 'react'
import type { Artifact } from '@agent-workspace/contracts'
import { InlineEditPopover } from '../InlineEditPopover'
import { ArtifactViewer } from './ArtifactViewer'
import { useArtifactDraft } from '../../hooks/useArtifactDraft'

interface Props {
  artifact: Artifact
  onSave: (data: { content: string; title?: string; changeNote?: string; source?: string }) => Promise<void>
  onCancel: () => void
  onDirtyChange?: (isDirty: boolean) => void
}

export function ArtifactEditor({ artifact, onSave, onCancel, onDirtyChange }: Props) {
  const [editTab, setEditTab] = useState<'edit' | 'preview'>('edit')
  const [editTitle, setEditTitle] = useState(artifact.title ?? '')
  const [editContent, setEditContent] = useState(artifact.content)
  const [editNote, setEditNote] = useState('')
  const [editSource, setEditSource] = useState<string | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [inlineSelection, setInlineSelection] = useState<{
    text: string
    start: number
    end: number
    beforeContext: string
    afterContext: string
  } | null>(null)
  const [showInlineEdit, setShowInlineEdit] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { isDirty, savedDraft, clearDraft } = useArtifactDraft({
    artifact,
    isEditing: true,
    title: editTitle,
    content: editContent,
    changeNote: editNote,
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const restoreDraft = () => {
    if (!savedDraft) return
    setEditTitle(savedDraft.title)
    setEditContent(savedDraft.content)
    setEditNote(savedDraft.changeNote ?? '')
  }

  const handleCancel = () => {
    if (isDirty && !window.confirm('有未保存的修改，确认放弃？')) return
    clearDraft()
    onCancel()
  }

  const handleSave = async () => {
    if (!editContent.trim() || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await onSave({
        content: editContent,
        title: editTitle !== artifact.title ? editTitle : undefined,
        changeNote: editNote || undefined,
        source: editSource,
      })
      clearDraft()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTextSelect = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    if (start === end) {
      setInlineSelection(null)
      return
    }
    setInlineSelection({
      text: editContent.substring(start, end),
      start,
      end,
      beforeContext: editContent.substring(Math.max(0, start - 1500), start),
      afterContext: editContent.substring(end, Math.min(editContent.length, end + 1500)),
    })
  }

  const handleInlineReplace = (replacement: string) => {
    if (!inlineSelection) return
    setEditContent(
      editContent.substring(0, inlineSelection.start) +
      replacement +
      editContent.substring(inlineSelection.end),
    )
    setEditSource('inline-edit')
    setShowInlineEdit(false)
    setInlineSelection(null)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex border-b">
        <button
          onClick={() => setEditTab('edit')}
          className={`px-4 py-1.5 text-xs font-medium ${editTab === 'edit' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          编辑
        </button>
        <button
          onClick={() => setEditTab('preview')}
          className={`px-4 py-1.5 text-xs font-medium ${editTab === 'preview' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          预览
        </button>
        {savedDraft && (
          <button
            onClick={restoreDraft}
            className="ml-auto px-3 py-1.5 text-xs text-amber-600 hover:text-amber-700"
          >
            恢复草稿
          </button>
        )}
      </div>

      {saveError && (
        <div className="mx-3 mt-3 text-xs text-red-600 bg-red-50 rounded p-2">{saveError}</div>
      )}

      {editTab === 'edit' ? (
        <div className="flex-1 flex flex-col overflow-hidden p-3 gap-2">
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="标题"
            className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            onSelect={handleTextSelect}
            className="flex-1 text-sm font-mono border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-0"
            spellCheck={false}
          />
          {inlineSelection && !showInlineEdit && (
            <button
              onClick={() => setShowInlineEdit(true)}
              className="self-end text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
            >
              AI 局部编辑
            </button>
          )}
          {showInlineEdit && inlineSelection && (
            <InlineEditPopover
              selectedText={inlineSelection.text}
              beforeContext={inlineSelection.beforeContext}
              afterContext={inlineSelection.afterContext}
              artifactId={artifact.id}
              artifactType={artifact.type}
              onReplace={handleInlineReplace}
              onCancel={() => setShowInlineEdit(false)}
            />
          )}
          <input
            value={editNote}
            onChange={e => setEditNote(e.target.value)}
            placeholder="变更说明（可选）"
            className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <ArtifactViewer artifact={{ ...artifact, content: editContent, title: editTitle }} />
        </div>
      )}

      <div className="border-t px-3 py-2 flex gap-2">
        <button
          onClick={handleSave}
          disabled={isSaving || !editContent.trim()}
          className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? '保存中...' : '保存为新版本'}
        </button>
        <button
          onClick={handleCancel}
          className="text-sm px-3 py-1 text-gray-500 hover:text-gray-700"
        >
          取消
        </button>
      </div>
    </div>
  )
}
