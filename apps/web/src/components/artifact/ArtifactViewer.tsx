import { useState } from 'react'
import type { Artifact } from '@agent-workspace/contracts'
import { HtmlSandbox } from '../HtmlSandbox'
import { MarkdownRenderer } from '../MarkdownRenderer'

export function ArtifactViewer({ artifact }: { artifact: Artifact }) {
  const [allowScripts, setAllowScripts] = useState(false)

  if (artifact.type === 'html') {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="h-9 border-b px-3 flex items-center justify-between bg-gray-50">
          <span className="text-xs text-gray-500">HTML 预览</span>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={allowScripts}
              onChange={e => setAllowScripts(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            允许脚本
          </label>
        </div>
        <div className="flex-1 min-h-0">
          <HtmlSandbox content={artifact.content} allowScripts={allowScripts} />
        </div>
      </div>
    )
  }

  if (artifact.type === 'markdown') {
    return <MarkdownRenderer content={artifact.content} />
  }

  return (
    <pre className="p-4 text-sm text-gray-800 whitespace-pre-wrap overflow-auto font-mono">
      {artifact.content}
    </pre>
  )
}
