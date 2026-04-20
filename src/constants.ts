export const PLUGIN_ID = 'noteva-ai-agent'
export const PLUGIN_NAME = 'Noteva AI Agent'
export const VIEW_TYPE_AI_AGENT = 'noteva-ai-agent-view'
export const SECRET_ID_OPENROUTER_API_KEY = 'noteva-ai-agent-openrouter-key'
export const HTTP_REFERER = 'https://github.com/Hoppieqqq/AI_Agent_Noteva'
export const X_TITLE = 'Noteva AI Agent for Obsidian'

export const COMMAND_IDS = {
  OPEN_VIEW: 'open-ai-agent',
  NEW_CHAT: 'new-chat',
  SUMMARIZE_CURRENT_NOTE: 'summarize-current-note',
  EXPLAIN_SELECTION: 'explain-selection',
  FIND_RELATED_NOTES: 'find-related-notes'
} as const

export const DEFAULT_SETTINGS = {
  defaultModel: 'openai/gpt-4.1-mini',
  manualModelOverride: '',
  systemPrompt:
    'You are Noteva AI Agent inside Obsidian. Help the user using vault context, backlinks, graph structure, and markdown notes. Never invent note contents. If information is missing, say so clearly.',
  contextMode: 'current-note' as const,
  graphDepth: 1,
  tokenBudget: 24000,
  memoryEnabled: true,
  debugMode: false,
  toolDebug: false,
  streamingEnabled: true,
  temperature: 0.4,
  maxTokens: 1400,
  autoExtractMemory: true,
  confirmBeforeWritingNotes: true,
  useTools: true
}
