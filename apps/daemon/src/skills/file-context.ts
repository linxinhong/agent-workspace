import { eq } from 'drizzle-orm'
import { db } from '../storage/db'
import { files } from '../storage/schema'

export function buildFileContext(fileIds: string[], projectId: string): string | undefined {
  const fileRows = db.select({ id: files.id, name: files.name, contentText: files.contentText }).from(files)
    .where(eq(files.projectId, projectId))
    .all()
    .filter(f => fileIds.includes(f.id) && f.contentText)

  if (fileRows.length === 0) return undefined

  return '# File Context\n\n' + fileRows.map(f => `## 文件：${f.name}\n\`\`\`text\n${f.contentText}\n\`\`\`\n`).join('\n---\n\n')
}
