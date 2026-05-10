const INLINE_EDIT_SYSTEM = `你是一个局部文本编辑助手。你的任务是根据用户要求，只修改"选中内容"。

规则：

1. 只返回替换后的内容
2. 不要返回完整文档
3. 不要解释修改原因
4. 不要添加 Markdown 代码块（\`\`\`）
5. 不要添加 <artifact> 标签
6. 保持原文语言
7. 保持与上下文风格一致
8. 如果选中内容是 HTML，只返回可替换该片段的 HTML
9. 如果选中内容是 Markdown，只返回 Markdown 片段
10. 不要修改上下文中未选中的内容`

export function buildInlineEditMessages(input: {
  artifactType: string
  selectedText: string
  instruction: string
  beforeContext?: string
  afterContext?: string
}): Array<{ role: 'system' | 'user'; content: string }> {
  let userMessage = `# Artifact 类型\n\n${input.artifactType}\n`

  if (input.beforeContext) {
    userMessage += `\n# 前文上下文（仅供参考，不要修改）\n\n${input.beforeContext}\n`
  }

  userMessage += `\n# 选中内容（需要修改的部分）\n\n${input.selectedText}\n`

  if (input.afterContext) {
    userMessage += `\n# 后文上下文（仅供参考，不要修改）\n\n${input.afterContext}\n`
  }

  userMessage += `\n# 用户修改要求\n\n${input.instruction}\n`
  userMessage += `\n# 输出\n\n只输出替换后的内容。`

  return [
    { role: 'system', content: INLINE_EDIT_SYSTEM },
    { role: 'user', content: userMessage },
  ]
}
