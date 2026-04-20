import { Events } from 'obsidian'
import { DEFAULT_SETTINGS } from '../constants'
import type { AgentSettings, ChatMessage, ChatThread, MemoryFact, PluginDataShape } from '../types'

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const nowIso = (): string => new Date().toISOString()

export class ChatRepository extends Events {
  private data: PluginDataShape = {
    settings: { ...DEFAULT_SETTINGS },
    chats: [],
    activeChatId: null,
    memoryFacts: []
  }

  constructor(
    private readonly loadPersisted: () => Promise<unknown>,
    private readonly persist: (data: PluginDataShape) => Promise<void>
  ) {
    super()
  }

  public async initialize(): Promise<void> {
    const raw = await this.loadPersisted()
    const parsed = (raw ?? {}) as Partial<PluginDataShape>

    this.data = {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      activeChatId: parsed.activeChatId ?? null,
      memoryFacts: Array.isArray(parsed.memoryFacts) ? parsed.memoryFacts : []
    }

    if (!this.data.activeChatId && this.data.chats[0]) {
      this.data.activeChatId = this.data.chats[0].id
      await this.save()
      return
    }

    this.trigger('changed')
  }

  public getSettings(): AgentSettings {
    return { ...this.data.settings }
  }

  public async updateSettings(patch: Partial<AgentSettings>): Promise<AgentSettings> {
    this.data.settings = { ...this.data.settings, ...patch }
    await this.save()
    return this.getSettings()
  }

  public getChats(): ChatThread[] {
    return [...this.data.chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  public getActiveChatId(): string | null {
    return this.data.activeChatId
  }

  public getChat(chatId: string): ChatThread | null {
    return this.data.chats.find((chat) => chat.id === chatId) ?? null
  }

  public async createChat(title = 'New chat'): Promise<ChatThread> {
    const chat: ChatThread = {
      id: createId(),
      title,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      messages: []
    }
    this.data.chats.unshift(chat)
    this.data.activeChatId = chat.id
    await this.save()
    return chat
  }

  public async setActiveChat(chatId: string): Promise<void> {
    this.data.activeChatId = chatId
    await this.save()
  }

  public async renameChat(chatId: string, title: string): Promise<void> {
    const chat = this.requireChat(chatId)
    chat.title = title.trim() || chat.title
    chat.updatedAt = nowIso()
    await this.save()
  }

  public async deleteChat(chatId: string): Promise<void> {
    this.data.chats = this.data.chats.filter((chat) => chat.id !== chatId)
    if (this.data.activeChatId === chatId) {
      this.data.activeChatId = this.data.chats[0]?.id ?? null
    }
    await this.save()
  }

  public async deleteAllChats(): Promise<void> {
    this.data.chats = []
    this.data.activeChatId = null
    await this.save()
  }

  public async clearChatHistory(chatId: string): Promise<void> {
    const chat = this.requireChat(chatId)
    chat.messages = []
    chat.updatedAt = nowIso()
    await this.save()
  }

  public async appendMessage(chatId: string, message: ChatMessage): Promise<void> {
    const chat = this.requireChat(chatId)
    chat.messages.push(message)
    chat.updatedAt = nowIso()
    if (chat.title === 'New chat' && message.role === 'user') {
      chat.title = this.suggestTitle(message.content)
    }
    await this.save()
  }

  public async replaceAssistantPlaceholder(chatId: string, model?: string): Promise<ChatMessage> {
    const chat = this.requireChat(chatId)
    const placeholder: ChatMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      createdAt: nowIso()
    }
    if (model) {
      placeholder.model = model
    }
    chat.messages.push(placeholder)
    chat.updatedAt = nowIso()
    await this.save()
    return placeholder
  }

  public async updateMessageContent(chatId: string, messageId: string, content: string): Promise<void> {
    const chat = this.requireChat(chatId)
    const message = chat.messages.find((item) => item.id === messageId)
    if (!message) {
      throw new Error('Message not found')
    }
    message.content = content
    chat.updatedAt = nowIso()
    await this.save()
  }

  public getMemoryFacts(): MemoryFact[] {
    return [...this.data.memoryFacts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  public async addMemoryFact(fact: string, source: 'manual' | 'extracted'): Promise<MemoryFact> {
    const trimmed = fact.trim()
    if (!trimmed) {
      throw new Error('Memory fact is empty')
    }

    const existing = this.data.memoryFacts.find((item) => item.fact.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      existing.updatedAt = nowIso()
      await this.save()
      return existing
    }

    const entry: MemoryFact = {
      id: createId(),
      fact: trimmed,
      source,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
    this.data.memoryFacts.unshift(entry)
    await this.save()
    return entry
  }

  public async deleteMemoryFact(id: string): Promise<void> {
    this.data.memoryFacts = this.data.memoryFacts.filter((item) => item.id !== id)
    await this.save()
  }

  public async updateMemoryFact(id: string, fact: string): Promise<void> {
    const trimmed = fact.trim()
    if (!trimmed) {
      throw new Error('Memory fact is empty')
    }

    const item = this.data.memoryFacts.find((entry) => entry.id === id)
    if (!item) {
      throw new Error('Memory fact not found')
    }

    item.fact = trimmed
    item.updatedAt = nowIso()
    await this.save()
  }

  public async clearMemory(): Promise<void> {
    this.data.memoryFacts = []
    await this.save()
  }

  private requireChat(chatId: string): ChatThread {
    const chat = this.getChat(chatId)
    if (!chat) {
      throw new Error(`Chat ${chatId} not found`)
    }
    return chat
  }

  private suggestTitle(message: string): string {
    const compact = message.replace(/\s+/g, ' ').trim()
    return compact.length <= 48 ? compact : `${compact.slice(0, 45)}...`
  }

  private async save(): Promise<void> {
    await this.persist(this.data)
    this.trigger('changed')
  }
}
