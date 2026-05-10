import { useState } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { fetchRunFile } from '../services/api'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

const statusConfig: Record<string, { label: string; color: string }> = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  error: { label: 'Error', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', color: 'bg-yellow-100 text-yellow-700' },
  timeout: { label: 'Timeout', color: 'bg-orange-100 text-orange-700' },
}

const sourceConfig: Record<string, { label: string; color: string }> = {
  file: { label: 'file', color: 'bg-emerald-50 text-emerald-600' },
  stdout: { label: 'stdout', color: 'bg-blue-50 text-blue-600' },
  refine: { label: 'refine', color: 'bg-purple-50 text-purple-600' },
  'inline-edit': { label: 'inline-edit', color: 'bg-amber-50 text-amber-600' },
  manual: { label: 'manual', color: 'bg-orange-50 text-orange-600' },
  template: { label: 'template', color: 'bg-teal-50 text-teal-600' },
  fallback: { label: 'fallback', color: 'bg-gray-100 text-gray-500' },
}

export function RunDetail() {
  const { state, closeRunDetail, openArtifact } = useWorkspace()
  const [viewingFile, setViewingFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')

  if (!state.activeRunDetail) return null

  const run = state.activeRunDetail
  const cfg = statusConfig[run.status] ?? statusConfig.error

  const handleViewFile = async (name: string) => {
    if (viewingFile === name) {
      setViewingFile(null)
      return
    }
    try {
      const content = await fetchRunFile(run.id, name)
      setFileContent(content)
      setViewingFile(name)
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-sm font-semibold text-gray-800">Run Detail</h3>
          <button onClick={closeRunDetail} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Overview */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Overview</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16">Agent</span>
                <span className="text-xs text-gray-700">{run.agentId ?? run.model ?? '-'}</span>
                {run.agentKind === 'cli' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">CLI</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16">Duration</span>
                <span className="text-xs text-gray-700">{run.durationMs != null ? formatDuration(run.durationMs) : '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16">Exit</span>
                <span className="text-xs text-gray-700">{run.exitCode != null ? run.exitCode : '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16">Artifacts</span>
                <span className="text-xs text-gray-700">{run.artifacts.length}</span>
              </div>
              {(run.timedOut || run.cancelled) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16">Flags</span>
                  {run.timedOut && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">Timed Out</span>}
                  {run.cancelled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-600">Cancelled</span>}
                </div>
              )}
            </div>
          </div>

          {/* Goal */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Goal</div>
            <p className="text-xs text-gray-700 bg-gray-50 rounded p-2">{run.goal ?? '(no goal)'}</p>
          </div>

          {/* Command */}
          {run.cwd && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Workspace</div>
              <p className="text-xs text-gray-600 font-mono bg-gray-50 rounded p-2 break-all">{run.cwd}</p>
            </div>
          )}

          {/* Materialized Files */}
          {run.materializedFiles.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Files</div>
              <div className="space-y-1">
                {run.materializedFiles.map((f) => {
                  const artifactMatch = f.kind === 'artifact'
                    ? run.artifacts.find(a => a.sourcePath === f.name)
                    : null
                  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
                  const typeMap: Record<string, string> = { md: 'markdown', html: 'html', htm: 'html', json: 'json', mmd: 'mermaid', tsx: 'react', txt: 'text' }
                  const artifactType = f.kind === 'artifact' ? (typeMap[ext] ?? 'file') : null

                  return (
                    <div key={f.name}>
                      <button
                        onClick={() => artifactMatch ? (openArtifact(artifactMatch.id), closeRunDetail()) : handleViewFile(f.name)}
                        className="flex items-center gap-2 w-full text-left px-2 py-1 rounded hover:bg-gray-50 text-xs"
                      >
                        <span className="text-gray-500 font-mono">{f.name}</span>
                        <span className="text-gray-300">{formatBytes(f.size)}</span>
                        {artifactType ? (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-600">{artifactType}</span>
                        ) : (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">{f.kind}</span>
                        )}
                      </button>
                      {viewingFile === f.name && !artifactMatch && (
                        <pre className="text-xs bg-gray-900 text-gray-100 rounded p-3 mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">{fileContent}</pre>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Log Previews */}
          {(run.stdoutPreview || run.stderrPreview) && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Logs</div>
              {run.stdoutPreview && (
                <div className="mb-2">
                  <div className="text-[10px] text-gray-400 mb-0.5">stdout</div>
                  <pre className="text-xs bg-gray-50 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">{run.stdoutPreview}</pre>
                </div>
              )}
              {run.stderrPreview && (
                <div>
                  <div className="text-[10px] text-gray-400 mb-0.5">stderr</div>
                  <pre className="text-xs bg-red-50 text-red-700 rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">{run.stderrPreview}</pre>
                </div>
              )}
            </div>
          )}

          {/* Artifacts */}
          {run.artifacts.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Artifacts</div>
              <div className="space-y-1">
                {run.artifacts.map((a) => {
                  const src = a.source ? sourceConfig[a.source] : null
                  return (
                    <button
                      key={a.id}
                      onClick={() => { openArtifact(a.id); closeRunDetail() }}
                      className="flex items-center gap-2 w-full text-left px-2 py-1 rounded hover:bg-blue-50 text-xs"
                    >
                      <span className="text-blue-600">{a.title ?? 'untitled'}</span>
                      <span className="text-gray-300">{a.type}</span>
                      {src && (
                        <span className={`text-[10px] px-1 py-0.5 rounded ${src.color}`}>{src.label}</span>
                      )}
                      {a.sourcePath && (
                        <span className="text-gray-400 font-mono text-[10px]">{a.sourcePath}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
