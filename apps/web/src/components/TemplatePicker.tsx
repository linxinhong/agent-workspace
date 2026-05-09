import { useState, useEffect } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import type { TemplateVariable } from '@agent-workspace/contracts'

export function TemplatePicker() {
  const { state, loadTemplates, openTemplate } = useWorkspace()

  useEffect(() => {
    loadTemplates()
  }, [])

  if (state.templates.length === 0) return null

  return (
    <div className="flex flex-col">
      <div className="h-9 border-b border-t flex items-center px-4">
        <span className="text-xs font-medium text-gray-500">Templates</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {state.templates.map((t) => (
          <button
            key={t.id}
            onClick={() => openTemplate(t.id)}
            className="w-full text-left px-4 py-2 border-b border-gray-50 hover:bg-gray-50"
          >
            <div className="text-xs font-medium text-gray-700 truncate">{t.name}</div>
            {t.description && <div className="text-[10px] text-gray-400 truncate mt-0.5">{t.description}</div>}
            <div className="flex gap-1 mt-1">
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{t.type}</span>
              {t.variableCount > 0 && <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{t.variableCount} 变量</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function TemplateForm() {
  const { state, dispatch, createFromTemplate, runWithTemplate } = useWorkspace()
  const template = state.activeTemplate
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [goal, setGoal] = useState('')

  useEffect(() => {
    if (template) {
      const defaults: Record<string, string> = {}
      for (const v of template.variables) {
        defaults[v.name] = v.defaultValue ?? ''
      }
      setVariables(defaults)
      setGoal('')
    }
  }, [template?.id])

  if (!template) return null

  const setVar = (name: string, value: string) => {
    setVariables(prev => ({ ...prev, [name]: value }))
  }

  const handleClose = () => {
    dispatch({ type: 'SET_ACTIVE_TEMPLATE', template: null })
  }

  const handleCreate = () => {
    createFromTemplate(template.id, variables)
  }

  const handleRunWithAgent = () => {
    runWithTemplate(template.id, variables, goal || `基于模板 "${template.name}" 生成内容`)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={handleClose}>
      <div className="bg-white rounded-xl shadow-xl w-[560px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{template.name}</h2>
            {template.description && <p className="text-sm text-gray-500 mt-0.5">{template.description}</p>}
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {template.variables.map((v: TemplateVariable) => (
            <div key={v.name}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {v.label}{v.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {v.type === 'textarea' ? (
                <textarea
                  value={variables[v.name] ?? ''}
                  onChange={e => setVar(v.name, e.target.value)}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              ) : v.type === 'select' && v.options ? (
                <select
                  value={variables[v.name] ?? ''}
                  onChange={e => setVar(v.name, e.target.value)}
                  className="w-full text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">请选择...</option>
                  {v.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={variables[v.name] ?? ''}
                  onChange={e => setVar(v.name, e.target.value)}
                  className="w-full text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">补充目标（可选）</label>
            <input
              type="text"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="例如：结合上传的告警原文优化内容"
              className="w-full text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="border-t px-5 py-3 flex gap-2">
          <button
            onClick={handleCreate}
            className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            直接创建
          </button>
          <button
            onClick={handleRunWithAgent}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            交给 Agent 优化
          </button>
        </div>
      </div>
    </div>
  )
}
