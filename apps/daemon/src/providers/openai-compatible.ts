export interface OpenAIProviderConfig {
  apiKey: string
  baseUrl: string
}

export async function* runOpenAI(
  input: {
    messages: Array<{ role: string; content: string }>
    model: string
  },
  config: OpenAIProviderConfig,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const url = `${config.baseUrl}/chat/completions`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    // Sanitize: truncate and strip API keys
    const safe = text.replace(/sk-[a-zA-Z0-9_-]{10,}/g, 'sk-***').slice(0, 200)
    throw new Error(`Provider error ${response.status}: ${safe}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
