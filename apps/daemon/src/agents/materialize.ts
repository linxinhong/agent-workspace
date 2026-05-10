import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

export interface MaterializeParams {
  runId: string
  projectId: string
  systemPrompt: string
  goal: string
  skillInstruction?: string
  fileContext?: string
  templateContent?: string
}

export function materializeWorkspace(params: MaterializeParams): string {
  const { runId, projectId, systemPrompt, goal, skillInstruction, fileContext, templateContent } = params

  const baseDir = resolve(process.cwd(), '.workspace')
  const runDir = resolve(baseDir, 'projects', projectId, 'agent-runs', runId)

  // Security: ensure path doesn't escape .workspace/
  const rel = relative(baseDir, runDir)
  if (rel.startsWith('..') || rel === '') {
    throw new Error('Invalid workspace path')
  }

  mkdirSync(runDir, { recursive: true })

  // PROMPT.md — assembled full prompt
  let prompt = `# System Instruction\n\n${systemPrompt}\n\n# User Goal\n\n${goal}`
  if (skillInstruction) prompt += `\n\n# Skill Instruction\n\n${skillInstruction}`
  if (fileContext) prompt += `\n\n# File Context\n\n${fileContext}`
  if (templateContent) prompt += `\n\n# Template\n\n${templateContent}`
  writeFileSync(join(runDir, 'PROMPT.md'), prompt, 'utf-8')

  // Individual files for reference
  if (skillInstruction) {
    writeFileSync(join(runDir, 'SKILL.md'), skillInstruction, 'utf-8')
  }
  if (fileContext) {
    writeFileSync(join(runDir, 'FILE_CONTEXT.md'), fileContext, 'utf-8')
  }
  if (templateContent) {
    writeFileSync(join(runDir, 'TEMPLATE.md'), templateContent, 'utf-8')
  }

  mkdirSync(join(runDir, 'artifacts'), { recursive: true })

  return runDir
}
