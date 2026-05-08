import type { UserGoal, Skill, Artifact } from '@agent-workspace/contracts'
import { BASE_PROMPT } from './base-prompt'

export function composeMessages(input: {
  skill?: Skill
  goal: UserGoal
}): Array<{ role: 'system' | 'user'; content: string }> {
  const systemParts = [BASE_PROMPT]

  if (input.skill?.instruction) {
    systemParts.push(input.skill.instruction)
  }

  return [
    { role: 'system', content: systemParts.join('\n\n') },
    { role: 'user', content: input.goal.content },
  ]
}

export function composeRefineMessages(input: {
  skill?: Skill
  originalArtifact: Artifact
  instruction: string
}): Array<{ role: 'system' | 'user'; content: string }> {
  const systemParts = [BASE_PROMPT]

  if (input.skill?.instruction) {
    systemParts.push(input.skill.instruction)
  }

  systemParts.push(`你正在修改一个已有的 Artifact。以下是原始内容：

<original-artifact type="${input.originalArtifact.type}" title="${input.originalArtifact.title}">
${input.originalArtifact.content}
</original-artifact>

请根据用户的要求修改以上内容，并输出修改后的完整 Artifact。`)

  return [
    { role: 'system', content: systemParts.join('\n\n') },
    { role: 'user', content: input.instruction },
  ]
}
