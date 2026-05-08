export function HtmlSandbox({ content }: { content: string }) {
  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={content}
      className="w-full h-full border-0"
      title="Artifact Preview"
    />
  )
}
