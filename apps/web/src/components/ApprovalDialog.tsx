import { useState } from 'react'
import type { AgentPermissions } from '../services/api'

const PERM_LABELS: Record<string, string> = {
  readProjectFiles: '读取项目文件',
  writeArtifactFiles: '写入 Artifact 文件',
  writeProjectFiles: '修改项目源文件',
  networkAccess: '访问网络',
  executeCommands: '执行本地命令',
}

const BOOL_PERMS = Object.keys(PERM_LABELS)

interface Props {
  agentName: string
  permissions: AgentPermissions
  permissionsHash: string
  onConfirm: (approval: { approved: boolean; permissionsHash: string }) => void
  onCancel: () => void
}

export function ApprovalDialog({ agentName, permissions, permissionsHash, onConfirm, onCancel }: Props) {
  const [confirmed, setConfirmed] = useState(false)

  const allowed = BOOL_PERMS.filter(k => permissions[k as keyof AgentPermissions] === true)
  const denied = BOOL_PERMS.filter(k => permissions[k as keyof AgentPermissions] === false)
  const isRemote = permissions.sendsDataToRemote

  const handleConfirm = () => {
    setConfirmed(true)
    onConfirm({ approved: true, permissionsHash })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {agentName} 权限确认
        </h3>

        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-green-700 mb-1">允许：</p>
            <ul className="space-y-0.5 text-gray-600">
              {allowed.map(k => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className="text-green-500">&#10003;</span> {PERM_LABELS[k]}
                </li>
              ))}
            </ul>
          </div>

          {denied.length > 0 && (
            <div>
              <p className="font-medium text-red-700 mb-1">不允许：</p>
              <ul className="space-y-0.5 text-gray-500">
                {denied.map(k => (
                  <li key={k} className="flex items-center gap-1.5">
                    <span className="text-red-400">&#10007;</span> {PERM_LABELS[k]}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isRemote && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="font-medium text-amber-800 mb-1">远程数据发送警告</p>
              <p className="text-amber-700">
                此 Agent 会将 Prompt、Skill、Template 和选中的文件上下文发送到远程服务：
                <br />
                <code className="text-xs bg-amber-100 px-1 rounded">{permissions.remoteEndpoint}</code>
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onCancel}
            disabled={confirmed}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirmed}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {confirmed ? '已确认' : '确认执行'}
          </button>
        </div>
      </div>
    </div>
  )
}
