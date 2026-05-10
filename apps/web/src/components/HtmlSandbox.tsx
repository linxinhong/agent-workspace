export function HtmlSandbox({ content, allowScripts = false }: { content: string; allowScripts?: boolean }) {
  return (
    <iframe
      sandbox={allowScripts ? 'allow-scripts' : ''}
      srcDoc={content}
      className="w-full h-full border-0"
      title="Artifact 预览"
    />
  )
}
