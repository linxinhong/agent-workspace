import { useState, useMemo } from 'react'
import { parseDiffFromFile } from '@pierre/diffs'
import { FileDiff } from '@pierre/diffs/react'
import { inlineEditArtifact } from '../services/api'

interface InlineEditPopoverProps {
  selectedText: string
  beforeContext?: string
  afterContext?: string
  artifactId: string
  artifactType: string
  onReplace: (replacement: string) => void
  onCancel: () => void
}

export function InlineEditPopover({
  selectedText,
  beforeContext,
  afterContext,
  artifactId,
  artifactType,
  onReplace,
  onCancel,
}: InlineEditPopoverProps) {
  const [instruction, setInstruction] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [replacement, setReplacement] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileDiff = useMemo(() => {
    if (replacement === null) return null
    try {
      return parseDiffFromFile(
        { name: 'original', contents: selectedText },
        { name: 'suggested', contents: replacement },
      )
    } catch {
      return null
    }
  }, [selectedText, replacement])

  const handleGenerate = async () => {
    if (!instruction.trim() || isGenerating) return
    setIsGenerating(true)
    setError(null)
    setReplacement(null)
    try {
      const result = await inlineEditArtifact({
        artifactId,
        selectedText,
        instruction,
        beforeContext,
        afterContext,
      })
      setReplacement(result.replacement)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReplace = () => {
    if (replacement !== null) {
      onReplace(replacement)
    }
  }

  const handleRetry = () => {
    setReplacement(null)
    setError(null)
  }

  return (
    <div className="border-t bg-gray-50 px-3 py-3 space-y-2">
      {error && (
        <div className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>
      )}

      {replacement !== null ? (
        <>
          <div className="border rounded overflow-hidden max-h-64 overflow-y-auto">
            {fileDiff ? (
              <FileDiff
                fileDiff={fileDiff}
                options={{
                  diffStyle: 'unified',
                  diffIndicators: 'classic',
                  lineDiffType: 'word-alt',
                  disableFileHeader: true,
                  disableLineNumbers: true,
                }}
              />
            ) : (
              <pre className="text-xs bg-blue-50 p-2 whitespace-pre-wrap">{replacement}</pre>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReplace}
              className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              替换
            </button>
            <button
              onClick={handleRetry}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
            >
              重试
            </button>
            <button
              onClick={onCancel}
              className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-600"
            >
              取消
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder="描述修改要求..."
              disabled={isGenerating}
              className="flex-1 text-sm rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              autoFocus
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !instruction.trim()}
              className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isGenerating ? '生成中...' : '生成'}
            </button>
            <button
              onClick={onCancel}
              disabled={isGenerating}
              className="text-sm px-2 py-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              取消
            </button>
          </div>
          {isGenerating && (
            <div className="text-xs text-gray-400">AI 正在生成建议修改...</div>
          )}
        </>
      )}
    </div>
  )
}
