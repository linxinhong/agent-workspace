import { useEffect } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'

export function SkillSelector() {
  const { state, dispatch, loadSkills, loadSkillDetail, reloadSkills, debugPrompt } = useWorkspace()

  useEffect(() => {
    loadSkills()
  }, [])

  if (state.skills.length === 0) return null

  return (
    <div className="px-4 py-3 border-b">
      <div className="flex gap-2 overflow-x-auto items-center">
        <button
          onClick={() => dispatch({ type: 'SELECT_SKILL', skillId: null })}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            state.selectedSkillId === null
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
          }`}
        >
          自动
        </button>
        {state.skills.map((skill) => (
          <div key={skill.id} className="relative shrink-0 group">
            <button
              onClick={() => dispatch({ type: 'SELECT_SKILL', skillId: skill.id })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                state.selectedSkillId === skill.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              } ${skill.warningCount > 0 ? 'ring-1 ring-amber-300' : ''}`}
            >
              {skill.name}
              {skill.warningCount > 0 && <span className="ml-1 text-amber-500">*</span>}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); loadSkillDetail(skill.id) }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-gray-200 hover:bg-gray-300 rounded-full text-[10px] leading-none text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="View details"
            >
              i
            </button>
          </div>
        ))}
        <div className="shrink-0 ml-auto flex gap-1">
          <button
            onClick={() => debugPrompt(state.goal)}
            className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:border-gray-300"
            title="Debug assembled prompt"
          >
            Debug
          </button>
          <button
            onClick={reloadSkills}
            className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:border-gray-300"
            title="Reload skills from disk"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  )
}
