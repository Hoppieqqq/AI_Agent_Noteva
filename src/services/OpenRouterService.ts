import { HTTP_REFERER, X_TITLE } from '../constants'
import type { CompletionResult, CompletionWithToolsResult, ModelOption, ToolCall, ToolDefinition } from '../types'

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
  tool_calls?: ToolCall[]
}

const OPENROUTER_CHAT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models'

const buildHeaders = (apiKey: string): HeadersInit => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': HTTP_REFERER,
  'X-Title': X_TITLE
})

const normalizeError = async (response: Response): Promise<Error> => {
  let message = `OpenRouter error (${response.status})`
  try {
    const payload = (await response.json()) as { error?: { message?: string } | string }
    if (typeof payload.error === 'string') {
      message = payload.error
    } else if (payload.error?.message) {
      message = payload.error.message
    }
  } catch {
    // ignore malformed error body
  }
  return new Error(message)
}

export class OpenRouterService {
  public async listModels(apiKey: string): Promise<ModelOption[]> {
    const response = await fetch(OPENROUTER_MODELS_ENDPOINT, {
      method: 'GET',
      headers: buildHeaders(apiKey)
    })
    if (!response.ok) {
      throw await normalizeError(response)
    }

    const payload = (await response.json()) as {
      data?: Array<{ id?: string; name?: string; context_length?: number; top_provider?: { max_completion_tokens?: number } }>
    }

    return (payload.data ?? [])
      .filter((model): model is { id: string; name?: string; context_length?: number; top_provider?: { max_completion_tokens?: number } } => Boolean(model.id))
      .map((model) => ({
        id: model.id,
        name: model.name ?? model.id,
        contextLength: model.context_length ?? null,
        maxCompletionTokens: model.top_provider?.max_completion_tokens ?? null
      }))
  }

  public async testConnection(apiKey: string, model: string): Promise<void> {
    await this.complete({
      apiKey,
      model,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      temperature: 0,
      maxTokens: 10
    })
  }

  public async complete(params: {
    apiKey: string
    model: string
    messages: OpenRouterMessage[]
    temperature: number
    maxTokens: number
  }): Promise<CompletionResult> {
    const response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
      method: 'POST',
      headers: buildHeaders(params.apiKey),
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: false
      })
    })

    if (!response.ok) {
      throw await normalizeError(response)
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }

    return {
      content: payload.choices?.[0]?.message?.content?.trim() ?? '',
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
      totalTokens: payload.usage?.total_tokens ?? 0
    }
  }

  public async completeWithTools(params: {
    apiKey: string
    model: string
    messages: OpenRouterMessage[]
    tools: ToolDefinition[]
    temperature: number
    maxTokens: number
  }): Promise<CompletionWithToolsResult> {
    const response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
      method: 'POST',
      headers: buildHeaders(params.apiKey),
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        tools: params.tools,
        tool_choice: 'auto',
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: false
      })
    })

    if (!response.ok) {
      throw await normalizeError(response)
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { role?: 'assistant'; content?: string; tool_calls?: ToolCall[] } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }

    const message: CompletionWithToolsResult['message'] = {
      role: 'assistant',
      content: payload.choices?.[0]?.message?.content ?? ''
    }
    const toolCalls = payload.choices?.[0]?.message?.tool_calls
    if (toolCalls) {
      message.tool_calls = toolCalls
    }

    return {
      message,
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
      totalTokens: payload.usage?.total_tokens ?? 0
    }
  }

  public async streamCompletion(params: {
    apiKey: string
    model: string
    messages: OpenRouterMessage[]
    temperature: number
    maxTokens: number
    signal?: AbortSignal
    onChunk: (text: string) => void | Promise<void>
  }): Promise<CompletionResult> {
    const requestInit: RequestInit = {
      method: 'POST',
      headers: buildHeaders(params.apiKey),
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: true
      })
    }

    if (params.signal) {
      requestInit.signal = params.signal
    }

    const response = await fetch(OPENROUTER_CHAT_ENDPOINT, requestInit)

    if (!response.ok || !response.body) {
      throw await normalizeError(response)
    }

    const decoder = new TextDecoder()
    const reader = response.body.getReader()
    let buffer = ''
    let content = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''

      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) {
            continue
          }
          const raw = line.slice(5).trim()
          if (!raw || raw === '[DONE]') {
            continue
          }
          const payload = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> }
          const delta = payload.choices?.[0]?.delta?.content ?? ''
          if (delta) {
            content += delta
            await params.onChunk(delta)
          }
        }
      }
    }

    return {
      content,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    }
  }
}
