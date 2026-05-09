import { useWorkspace } from '../context/WorkspaceContext'

export function GoalInput() {
  const { state, dispatch, runAgent, cancelCurrentRun } = useWorkspace()

  const handleSubmit = () => {
    if (state.goal.trim() && !state.isRunning) {
      runAgent()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  return (
    <div className="p-4 border-b">
      <div className="flex gap-2">
        <textarea
          value={state.goal}
          onChange={(e) => dispatch({ type: 'SET_GOAL', goal: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="描述你想完成的目标..."
          disabled={state.isRunning}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        {state.isRunning ? (
          <button
            onClick={cancelCurrentRun}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 shrink-0"
          >
            取消
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!state.goal.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            执行
          </button>
        )}
      </div>
      {state.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}
    </div>
  )
}
