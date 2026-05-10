import type { Artifact } from '@agent-workspace/contracts'

interface Props {
  currentId: string
  versionChain: Artifact[]
  generatedArtifacts: Artifact[]
  activeIndex: number
  hasActiveArtifact: boolean
  onOpenVersion: (id: string) => void
  onSelectGenerated: (index: number) => void
}

export function ArtifactVersionBar({
  currentId,
  versionChain,
  generatedArtifacts,
  activeIndex,
  hasActiveArtifact,
  onOpenVersion,
  onSelectGenerated,
}: Props) {
  return (
    <>
      {versionChain.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b overflow-x-auto">
          {versionChain.map((v, i) => (
            <span key={v.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300 text-xs">&rarr;</span>}
              <button
                onClick={() => onOpenVersion(v.id)}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  v.id === currentId
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                v{i + 1}
              </button>
            </span>
          ))}
        </div>
      )}

      {!hasActiveArtifact && generatedArtifacts.length > 1 && (
        <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto">
          {generatedArtifacts.map((a, i) => (
            <button
              key={a.id}
              onClick={() => onSelectGenerated(i)}
              className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                i === activeIndex
                  ? 'bg-gray-200 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {a.title}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
