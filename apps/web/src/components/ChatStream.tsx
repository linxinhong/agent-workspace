import { useEffect, useRef } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'

export function ChatStream() {
  const { state } = useWorkspace()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages])

  if (state.messages.length === 0 && !state.isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        选择一个能力，描述你的目标，开始执行
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {state.messages.map((msg, i) => (
        <pre key={i} className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
          {msg.content}
        </pre>
      ))}
      {state.isRunning && (
        <span className="inline-block w-2 h-4 bg-blue-600 animate-pulse" />
      )}
      <div ref={bottomRef} />
    </div>
  )
}
