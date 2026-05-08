import { useEffect } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'

export function SkillSelector() {
  const { state, dispatch, loadSkills } = useWorkspace()

  useEffect(() => {
    loadSkills()
  }, [])

  if (state.skills.length === 0) return null

  return (
    <div className="px-4 py-3 border-b">
      <div className="flex gap-2 overflow-x-auto">
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
          <button
            key={skill.id}
            onClick={() => dispatch({ type: 'SELECT_SKILL', skillId: skill.id })}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              state.selectedSkillId === skill.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            {skill.name}
          </button>
        ))}
      </div>
    </div>
  )
}
