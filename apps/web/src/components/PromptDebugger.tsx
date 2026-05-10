import { useState } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'

export function PromptDebugger() {
  const { state, debugPrompt, dispatch } = useWorkspace()
  const [goal, setGoal] = useState('')

  if (!state.debugMessages && !state.activeSkillDetail) return null

  const handleDebug = () => {
    if (!goal.trim()) return
    debugPrompt(goal)
  }

  const handleClose = () => {
    dispatch({ type: 'SET_DEBUG_MESSAGES', messages: null })
    dispatch({ type: 'SET_ACTIVE_SKILL_DETAIL', detail: null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={handleClose}>
      <div className="bg-white rounded-xl shadow-xl w-[720px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Prompt 调试器</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>

        <div className="px-5 py-3 border-b flex gap-2">
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="输入目标以预览最终 Prompt..."
            className="flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={e => e.key === 'Enter' && handleDebug()}
          />
          <button onClick={handleDebug} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">预览</button>
        </div>

        {state.selectedSkillId && (
          <div className="px-5 py-1.5 border-b text-xs text-gray-500">
            Skill: <span className="font-medium text-gray-700">{state.skills.find(s => s.id === state.selectedSkillId)?.name}</span>
            {state.selectedFileIds.length > 0 && <span className="ml-3">文件上下文: {state.selectedFileIds.length} 个</span>}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {state.debugMessages ? state.debugMessages.map((msg, i) => (
            <div key={i} className="border-b">
              <div className="px-5 py-1.5 bg-gray-50 text-xs font-medium text-gray-500 flex items-center gap-2">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${msg.role === 'system' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{msg.role.toUpperCase()}</span>
                <span>{msg.content.length.toLocaleString()} 字符</span>
              </div>
              <pre className="px-5 py-3 text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">{msg.content}</pre>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-sm text-gray-400">输入目标并点击预览，查看组装后的 Prompt</div>
          )}
        </div>
      </div>
    </div>
  )
}
