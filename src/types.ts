export type AIContextMode =
  | 'none'
  | 'current-note'
  | 'current-note-linked'
  | 'current-note-backlinks'
  | 'folder'
  | 'vault'
  | 'graph-neighborhood'

export interface AgentSettings {
  defaultModel: string
  manualModelOverride: string
  systemPrompt: string
  contextMode: AIContextMode
  graphDepth: number
  tokenBudget: number
  memoryEnabled: boolean
  debugMode: boolean
  toolDebug: boolean
  streamingEnabled: boolean
  temperature: number
  maxTokens: number
  autoExtractMemory: boolean
  confirmBeforeWritingNotes: boolean
  useTools: boolean
}

export interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  createdAt: string
  model?: string
  toolName?: string
  toolCallId?: string
}

export interface ChatThread {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export interface ChatListFilterResult {
  items: ChatThread[]
  query: string
}

export interface MemoryFact {
  id: string
  fact: string
  source: 'manual' | 'extracted'
  createdAt: string
  updatedAt: string
}

export interface PluginDataShape {
  settings: AgentSettings
  chats: ChatThread[]
  activeChatId: string | null
  memoryFacts: MemoryFact[]
}

export interface ModelOption {
  id: string
  name: string
  contextLength?: number | null
  maxCompletionTokens?: number | null
}

export interface IndexedNote {
  path: string
  basename: string
  title: string
  folder: string
  tags: string[]
  links: string[]
  backlinks: string[]
  headings: string[]
  frontmatter: Record<string, unknown>
  content: string
  modifiedTime: number
}

export interface ContextBuildResult {
  mode: AIContextMode
  label: string
  notes: IndexedNote[]
  contextText: string
  estimatedTokens: number
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface CompletionMessage {
  role: 'assistant'
  content: string
  tool_calls?: ToolCall[]
}

export interface CompletionResult {
  content: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface CompletionWithToolsResult {
  message: CompletionMessage
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface SendMessageOptions {
  chatId: string
  message: string
  activeFilePath?: string | null
  selection?: string | null
}

export interface ChatTurnResult {
  assistantMessage: ChatMessage
  context: ContextBuildResult
}

export interface RelatedNoteSummary {
  path: string
  title: string
  score: number
}

export interface WriteConfirmationRequest {
  action: 'create' | 'append'
  path: string
  contentPreview: string
}
