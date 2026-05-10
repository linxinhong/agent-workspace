import type { Artifact } from '@agent-workspace/contracts'

interface Props {
  artifact: Artifact
  versionNum: number
  isDirty: boolean
  copied: boolean
  isEditing: boolean
  showRefine: boolean
  onCopy: () => void
  onDownload: () => void
  onEdit: () => void
  onRefine: () => void
  onClose?: () => void
}

export function ArtifactToolbar({
  artifact,
  versionNum,
  isDirty,
  copied,
  isEditing,
  showRefine,
  onCopy,
  onDownload,
  onEdit,
  onRefine,
  onClose,
}: Props) {
  return (
    <div className="h-10 border-b flex items-center px-3 gap-2 shrink-0">
      <span className="text-sm font-medium text-gray-700 truncate">{artifact.title}</span>
      <span className="text-xs text-gray-400">&middot;</span>
      <span className="text-xs text-gray-400">{artifact.type}</span>
      <span className="text-xs text-gray-400">&middot;</span>
      <span className="text-xs text-gray-400">v{versionNum}</span>
      {isDirty && <span className="text-xs text-amber-500 font-medium">未保存</span>}

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={onCopy}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded hover:border-gray-300"
        >
          {copied ? '已复制' : '复制'}
        </button>
        <button
          onClick={onDownload}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded hover:border-gray-300"
        >
          下载
        </button>
        {!isEditing && !showRefine && (
          <button
            onClick={onEdit}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 rounded hover:border-gray-300"
          >
            编辑
          </button>
        )}
        {!isEditing && !showRefine && (
          <button
            onClick={onRefine}
            className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:border-blue-300"
          >
            优化
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
            aria-label="关闭产物"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  )
}
