export function stripAnsi(input: string): string {
  return input.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
}

const RICH_PANEL_RE = /^[╭╰╮╯│─┃┏┓┗┛┣┫┳┻╋═].*$/gm
const SESSION_ID_RE = /^\n*session_id:\s+\S+\s*$/gm

export function stripRichDecorations(input: string): string {
  return input
    .replace(RICH_PANEL_RE, '')
    .replace(SESSION_ID_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
