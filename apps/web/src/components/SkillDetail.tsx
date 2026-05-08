import { useWorkspace } from '../context/WorkspaceContext'

export function SkillDetail() {
  const { state, dispatch } = useWorkspace()
  const detail = state.activeSkillDetail

  if (!detail) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => dispatch({ type: 'SET_ACTIVE_SKILL_DETAIL', detail: null })}>
      <div className="bg-white rounded-xl shadow-xl w-[640px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{detail.name}</h2>
            {detail.description && <p className="text-sm text-gray-500 mt-0.5">{detail.description}</p>}
          </div>
          <button onClick={() => dispatch({ type: 'SET_ACTIVE_SKILL_DETAIL', detail: null })} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>

        <div className="px-5 py-3 border-b flex gap-3 text-xs text-gray-500">
          <span>输出类型: <span className="font-medium text-gray-700">{detail.outputTypes.join(', ')}</span></span>
          {detail.path && <span>路径: <span className="font-mono text-gray-600">{detail.path}</span></span>}
        </div>

        {detail.warnings.length > 0 && (
          <div className="px-5 py-2 border-b bg-amber-50">
            {detail.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700">{w.type === 'missing_section' ? '⚠' : '⚠'} {w.message}</p>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">{detail.instruction}</pre>
        </div>
      </div>
    </div>
  )
}
