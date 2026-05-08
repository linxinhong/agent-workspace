import { parseArtifacts } from './parse-artifact'

let passed = 0
let failed = 0

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}`)
  }
}

// 1. Single artifact
{
  const result = parseArtifacts(
    'Some text\n<artifact type="markdown" title="Test">Hello world</artifact>\nMore text'
  )
  assert(result.length === 1, 'single artifact: count')
  assert(result[0].type === 'markdown', 'single artifact: type')
  assert(result[0].title === 'Test', 'single artifact: title')
  assert(result[0].content === 'Hello world', 'single artifact: content')
}

// 2. Multiple artifacts
{
  const result = parseArtifacts(
    '<artifact type="markdown" title="A">Content A</artifact>\n\n<artifact type="html" title="B">Content B</artifact>'
  )
  assert(result.length === 2, 'multiple artifacts: count')
  assert(result[0].type === 'markdown', 'multiple artifacts: first type')
  assert(result[1].type === 'html', 'multiple artifacts: second type')
}

// 3. Attribute order reversed (title before type)
{
  const result = parseArtifacts(
    '<artifact title="Reversed" type="json">{"key":"val"}</artifact>'
  )
  assert(result.length === 1, 'reversed attrs: count')
  assert(result[0].type === 'json', 'reversed attrs: type')
  assert(result[0].title === 'Reversed', 'reversed attrs: title')
}

// 4. Single quotes
{
  const result = parseArtifacts(
    "<artifact type='html' title='Quoted'>Content</artifact>"
  )
  assert(result.length === 1, 'single quotes: count')
  assert(result[0].type === 'html', 'single quotes: type')
  assert(result[0].title === 'Quoted', 'single quotes: title')
}

// 5. Missing title defaults to Untitled
{
  const result = parseArtifacts(
    '<artifact type="markdown">No title here</artifact>'
  )
  assert(result.length === 1, 'no title: count')
  assert(result[0].title === 'Untitled', 'no title: default')
}

// 6. Markdown content with code blocks
{
  const result = parseArtifacts(
    '<artifact type="markdown" title="Code">Here is code:\n```js\nconsole.log("hello")\n```\nDone</artifact>'
  )
  assert(result.length === 1, 'code blocks: count')
  assert(result[0].content.includes('console.log'), 'code blocks: content preserved')
}

// 7. HTML content with quotes
{
  const result = parseArtifacts(
    '<artifact type="html" title="Page"><div class="foo" style="color: red">text</div></artifact>'
  )
  assert(result.length === 1, 'html quotes: count')
  assert(result[0].content.includes('class="foo"'), 'html quotes: content preserved')
}

// 8. No closing tag — best effort
{
  const result = parseArtifacts(
    '<artifact type="markdown" title="Open">Some content without closing'
  )
  assert(result.length === 1, 'no close tag: count')
  assert(result[0].content.includes('Some content'), 'no close tag: content captured')
}

// 9. Mixed text and artifacts
{
  const result = parseArtifacts(
    'Intro text\n<artifact type="markdown" title="A">First</artifact>\nMiddle text\n<artifact type="html" title="B">Second</artifact>\nEnd text'
  )
  assert(result.length === 2, 'mixed text: count')
  assert(result[0].content === 'First', 'mixed text: first content')
  assert(result[1].content === 'Second', 'mixed text: second content')
}

// 10. No artifacts
{
  const result = parseArtifacts('Just plain text, nothing special here.')
  assert(result.length === 0, 'no artifacts: count')
}

// 11. No quotes on attributes
{
  const result = parseArtifacts(
    '<artifact type=markdown title=NoQuotes>Content</artifact>'
  )
  assert(result.length === 1, 'no quotes attrs: count')
  assert(result[0].type === 'markdown', 'no quotes attrs: type')
  assert(result[0].title === 'NoQuotes', 'no quotes attrs: title')
}

console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
