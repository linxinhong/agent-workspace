import { useState } from 'react'
import type { ArtifactBundleManifest } from '@agent-workspace/contracts'
import { HtmlSandbox } from './HtmlSandbox'
import { MarkdownRenderer } from './MarkdownRenderer'

interface BundlePreviewProps {
  manifest: ArtifactBundleManifest
}

function FileTree({ files, selected, onSelect }: {
  files: ArtifactBundleManifest['files']
  selected: string | null
  onSelect: (path: string) => void
}) {
  return (
    <div className="w-52 border-r overflow-y-auto text-xs">
      <div className="px-2 py-1.5 text-gray-400 font-medium border-b">Files</div>
      {files.map(f => (
        <button
          key={f.path}
          onClick={() => onSelect(f.path)}
          className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 font-mono truncate block ${
            selected === f.path ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
          }`}
        >
          {f.path}
        </button>
      ))}
    </div>
  )
}

export function BundlePreview({ manifest }: BundlePreviewProps) {
  const entry = manifest.entry
    ? manifest.files.find(f => f.path === manifest.entry)
    : null
  const initialPath = entry?.path ?? manifest.files[0]?.path ?? ''
  const [selectedPath, setSelectedPath] = useState(initialPath)

  const selected = manifest.files.find(f => f.path === selectedPath) ?? manifest.files[0]
  if (!selected) return null

  const isHtml = selected.path.endsWith('.html') || selected.path.endsWith('.htm')
  const isMarkdown = selected.path.endsWith('.md') || selected.path.endsWith('.txt')

  return (
    <div className="flex flex-1 min-h-0">
      <FileTree files={manifest.files} selected={selectedPath} onSelect={setSelectedPath} />
      <div className="flex-1 overflow-auto">
        {isHtml ? (
          <HtmlSandbox content={selected.content} />
        ) : isMarkdown ? (
          <div className="p-4">
            <MarkdownRenderer content={selected.content} />
          </div>
        ) : (
          <pre className="p-4 text-sm text-gray-800 whitespace-pre-wrap overflow-auto font-mono">
            {selected.content}
          </pre>
        )}
      </div>
    </div>
  )
}
