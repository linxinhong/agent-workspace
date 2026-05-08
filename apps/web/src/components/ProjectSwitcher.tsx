import { useState } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'

export function ProjectSwitcher() {
  const { state, switchProject, createNewProject } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const current = state.projects.find(p => p.id === state.currentProjectId)

  const handleCreate = () => {
    if (!newName.trim()) return
    createNewProject(newName.trim())
    setNewName('')
    setCreating(false)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium text-gray-900 truncate max-w-48">
          {current?.name ?? '选择项目'}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setCreating(false) }} />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-20 py-1">
            {state.projects.map((p) => (
              <button
                key={p.id}
                onClick={() => { switchProject(p.id); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  p.id === state.currentProjectId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <span className="font-medium">{p.name}</span>
                {p.description && (
                  <span className="block text-xs text-gray-400 mt-0.5 truncate">{p.description}</span>
                )}
              </button>
            ))}

            <div className="border-t mt-1 pt-1 px-3 py-2">
              {creating ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="项目名称"
                    className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <button onClick={handleCreate} className="text-sm text-blue-600 hover:text-blue-800">创建</button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + 新建项目
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
