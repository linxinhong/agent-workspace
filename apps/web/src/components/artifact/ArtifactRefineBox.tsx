interface Props {
  value: string
  isRunning: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export function ArtifactRefineBox({ value, isRunning, onChange, onSubmit, onCancel }: Props) {
  return (
    <div className="border-t px-3 py-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder="输入修改要求..."
          disabled={isRunning}
          className="flex-1 text-sm rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
        <button
          onClick={onSubmit}
          disabled={isRunning || !value.trim()}
          className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          修改
        </button>
        <button
          onClick={onCancel}
          className="text-sm px-2 py-1 text-gray-500 hover:text-gray-700"
        >
          取消
        </button>
      </div>
    </div>
  )
}
