import type { TFile } from 'obsidian'
import type { ChatMessage, ChatTurnResult, SendMessageOptions } from '../types'
import { ChatRepository } from './ChatRepository'
import { ContextBuilder } from './ContextBuilder'
import { MemoryService } from './MemoryService'
import { OpenRouterService } from './OpenRouterService'
import { ToolExecutor } from './ToolExecutor'

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
}

export class AgentService {
  private abortController: AbortController | null = null

  constructor(
    private readonly repository: ChatRepository,
    private readonly openRouter: OpenRouterService,
    private readonly contextBuilder: ContextBuilder,
    private readonly memory: MemoryService,
    private readonly toolExecutor: ToolExecutor,
    private readonly getActiveFile: () => TFile | null,
    private readonly getApiKey: () => string
  ) {}

  public isStreaming(): boolean {
    return this.abortController !== null
  }

  public stop(): void {
    this.abortController?.abort('user-stop')
    this.abortController = null
  }

  public async sendMessage(options: SendMessageOptions, onStream?: (nextContent: string) => Promise<void>): Promise<ChatTurnResult> {
    const settings = this.repository.getSettings()
    const chat = this.repository.getChat(options.chatId)
    if (!chat) {
      throw new Error('Chat not found')
    }

    const apiKey = this.getApiKey().trim()
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured')
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: options.message.trim(),
      createdAt: new Date().toISOString()
    }
    await this.repository.appendMessage(options.chatId, userMessage)

    const context = await this.contextBuilder.build({
      settings,
      activeFile: this.getActiveFile()
    })

    const systemBlocks = [settings.systemPrompt]
    const memoryBlock = settings.memoryEnabled ? this.memory.buildPromptBlock() : ''
    if (memoryBlock) {
      systemBlocks.push(memoryBlock)
    }
    if (context.contextText) {
      systemBlocks.push(`Vault context (${context.label}):\n${context.contextText}`)
    }

    const history = chat.messages.map((message) => this.toOpenRouterMessage(message))
    const model = settings.manualModelOverride.trim() || settings.defaultModel
    const promptMessages: OpenRouterMessage[] = [
      { role: 'system', content: systemBlocks.join('\n\n') },
      ...history,
      { role: 'user', content: options.message.trim() }
    ]

    if (settings.useTools) {
      const withTools = await this.runToolLoop({
        apiKey,
        model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        history: promptMessages
      })
      await this.repository.appendMessage(options.chatId, withTools.assistantMessage)
      if (settings.memoryEnabled && settings.autoExtractMemory) {
        await this.memory.extractFromConversation(`${options.message}\n${withTools.assistantMessage.content}`)
      }
      return { assistantMessage: withTools.assistantMessage, context }
    }

    const assistantMessage: ChatMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      model
    }
    await this.repository.appendMessage(options.chatId, assistantMessage)

    this.abortController = new AbortController()
    let streamed = ''
    try {
      const result = settings.streamingEnabled
        ? await this.openRouter.streamCompletion({
            apiKey,
            model,
            messages: promptMessages,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            signal: this.abortController.signal,
            onChunk: async (chunk) => {
              streamed += chunk
              if (onStream) {
                await onStream(streamed)
              }
            }
          })
        : await this.openRouter.complete({
            apiKey,
            model,
            messages: promptMessages,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens
          })

      assistantMessage.content = result.content || streamed
      await this.repository.updateMessageContent(options.chatId, assistantMessage.id, assistantMessage.content)
      if (settings.memoryEnabled && settings.autoExtractMemory) {
        await this.memory.extractFromConversation(`${options.message}\n${assistantMessage.content}`)
      }
      return { assistantMessage, context }
    } finally {
      this.abortController = null
    }
  }

  private async runToolLoop(params: {
    apiKey: string
    model: string
    temperature: number
    maxTokens: number
    history: OpenRouterMessage[]
  }): Promise<{ assistantMessage: ChatMessage }> {
    const conversation: OpenRouterMessage[] = [...params.history]

    for (let iteration = 0; iteration < 3; iteration += 1) {
      const completion = await this.openRouter.completeWithTools({
        apiKey: params.apiKey,
        model: params.model,
        messages: conversation,
        tools: this.toolExecutor.getDefinitions(),
        temperature: params.temperature,
        maxTokens: params.maxTokens
      })

      const toolCalls = completion.message.tool_calls ?? []
      if (toolCalls.length === 0) {
        return {
          assistantMessage: {
            id: createId(),
            role: 'assistant',
            content: completion.message.content.trim(),
            createdAt: new Date().toISOString(),
            model: params.model
          }
        }
      }

      conversation.push({ role: 'assistant', content: completion.message.content })

      for (const toolCall of toolCalls) {
        const result = await this.toolExecutor.execute(toolCall)
        conversation.push({
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
          name: toolCall.function.name
        })
      }
    }

    return {
      assistantMessage: {
        id: createId(),
        role: 'assistant',
        content: 'Tool execution reached the loop limit. Please refine the request.',
        createdAt: new Date().toISOString(),
        model: params.model
      }
    }
  }

  private toOpenRouterMessage(message: ChatMessage): OpenRouterMessage {
    const payload: OpenRouterMessage = {
      role: message.role,
      content: message.content
    }

    if (message.toolCallId) {
      payload.tool_call_id = message.toolCallId
    }

    if (message.toolName) {
      payload.name = message.toolName
    }

    return payload
  }
}
