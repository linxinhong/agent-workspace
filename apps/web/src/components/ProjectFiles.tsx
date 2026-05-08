import { useRef } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { uploadFile, deleteFile } from '../services/api'

export function ProjectFiles() {
  const { state, dispatch } = useWorkspace()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !state.currentProjectId) return
    try {
      const result = await uploadFile(state.currentProjectId, file)
      dispatch({ type: 'ADD_FILE', file: { id: result.id, projectId: state.currentProjectId, name: file.name, mimeType: file.type, size: file.size, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Upload failed' })
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDelete = async (id: string) => {
    await deleteFile(id)
    dispatch({ type: 'REMOVE_FILE', fileId: id })
  }

  const toggleSelect = (id: string) => {
    dispatch({ type: 'TOGGLE_FILE_SELECTION', fileId: id })
  }

  if (!state.currentProjectId) return null

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Project Files</span>
        <label className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
          + 上传
          <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} accept=".md,.txt,.json,.csv,.html,.xml,.log,.yaml,.yml" />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto">
        {state.projectFiles.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-4">暂无文件</div>
        ) : state.projectFiles.map((f) => (
          <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={state.selectedFileIds.includes(f.id)}
              onChange={() => toggleSelect(f.id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700 truncate flex-1">{f.name}</span>
            <button onClick={() => handleDelete(f.id)} className="text-xs text-gray-400 hover:text-red-500">x</button>
          </div>
        ))}
      </div>
    </div>
  )
}
