import { ItemView, Modal, Notice, WorkspaceLeaf } from 'obsidian'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { VIEW_TYPE_AI_AGENT } from '../constants'
import type NotevaAIAgentPlugin from '../main'
import type { ChatThread, MemoryFact } from '../types'
import { ChatListPanel } from './ChatListPanel'
import { ChatMessagesPanel } from './ChatMessagesPanel'
import { InputBar } from './InputBar'
import { MemoryPanel } from './MemoryPanel'

class PromptModal extends Modal {
  private resolveValue: ((value: string | null) => void) | null = null

  constructor(app: NotevaAIAgentPlugin['app'], private readonly titleText: string, private readonly initialValue = '') {
    super(app)
  }

  public openAndWait(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolveValue = resolve
      this.open()
    })
  }

  public override onOpen(): void {
    const { contentEl } = this
    contentEl.empty()
    contentEl.createEl('h3', { text: this.titleText })
    const input = contentEl.createEl('input', { type: 'text', value: this.initialValue })
    input.addClass('noteva-ai-modal-input')
    input.focus()
    input.select()
    const buttons = contentEl.createDiv({ cls: 'noteva-ai-modal-actions' })
    const cancel = buttons.createEl('button', { text: 'Cancel' })
    const confirm = buttons.createEl('button', { text: 'Confirm' })
    confirm.addClass('mod-cta')
    cancel.addEventListener('click', () => this.finish(null))
    confirm.addEventListener('click', () => this.finish(input.value.trim() || null))
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.finish(input.value.trim() || null)
      }
    })
  }

  public override onClose(): void {
    this.contentEl.empty()
    if (this.resolveValue) {
      this.resolveValue(null)
      this.resolveValue = null
    }
  }

  private finish(value: string | null): void {
    const resolve = this.resolveValue
    this.resolveValue = null
    this.close()
    resolve?.(value)
  }
}

interface AgentAppProps {
  plugin: NotevaAIAgentPlugin
}

const AgentApp = ({ plugin }: AgentAppProps): React.JSX.Element => {
  const [chats, setChats] = React.useState<ChatThread[]>(plugin.repository.getChats())
  const [activeChatId, setActiveChatId] = React.useState<string | null>(plugin.repository.getActiveChatId())
  const [memoryFacts, setMemoryFacts] = React.useState<MemoryFact[]>(plugin.repository.getMemoryFacts())
  const [input, setInput] = React.useState('')
  const [isBusy, setIsBusy] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [contextLabel, setContextLabel] = React.useState(plugin.repository.getSettings().contextMode)
  const [memoryEnabled, setMemoryEnabled] = React.useState(plugin.repository.getSettings().memoryEnabled)
  const [activeFilePath, setActiveFilePath] = React.useState(plugin.app.workspace.getActiveFile()?.path ?? null)

  const refresh = React.useCallback(() => {
    setChats(plugin.repository.getChats())
    setActiveChatId(plugin.repository.getActiveChatId())
    setMemoryFacts(plugin.repository.getMemoryFacts())
    const settings = plugin.repository.getSettings()
    setContextLabel(settings.contextMode)
    setMemoryEnabled(settings.memoryEnabled)
    setActiveFilePath(plugin.app.workspace.getActiveFile()?.path ?? null)
  }, [plugin])

  React.useEffect(() => {
    refresh()
    const eventRef = plugin.repository.on('changed', refresh)
    const workspaceEvent = plugin.app.workspace.on('active-leaf-change', refresh)
    return () => {
      plugin.repository.offref(eventRef)
      plugin.app.workspace.offref(workspaceEvent)
    }
  }, [plugin, refresh])

  const filteredChats = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return chats
    }
    return chats.filter((chat) => {
      if (chat.title.toLowerCase().includes(query)) {
        return true
      }
      return chat.messages.some((message) => message.content.toLowerCase().includes(query))
    })
  }, [chats, search])

  const activeChat = React.useMemo(() => (activeChatId ? plugin.repository.getChat(activeChatId) : null), [activeChatId, chats, plugin])
  const lastUserMessage = React.useMemo(() => activeChat?.messages.filter((message) => message.role === 'user').at(-1) ?? null, [activeChat])

  const ensureChat = React.useCallback(async (): Promise<string> => {
    if (activeChatId) {
      return activeChatId
    }
    const created = await plugin.repository.createChat()
    return created.id
  }, [activeChatId, plugin])

  const send = React.useCallback(async () => {
    const payload = input.trim()
    if (!payload) {
      return
    }
    const chatId = await ensureChat()
    setInput('')
    setIsBusy(true)

    try {
      await plugin.agent.sendMessage(
        {
          chatId,
          message: payload,
          activeFilePath: plugin.app.workspace.getActiveFile()?.path ?? null,
          selection: plugin.getActiveSelection()
        },
        async (nextContent) => {
          const currentChat = plugin.repository.getChat(chatId)
          const lastAssistant = currentChat?.messages.filter((message) => message.role === 'assistant').at(-1)
          if (lastAssistant) {
            await plugin.repository.updateMessageContent(chatId, lastAssistant.id, nextContent)
          }
        }
      )
    } catch (error) {
      console.error('[noteva-ai-agent] send error', error)
      new Notice(error instanceof Error ? error.message : 'Could not send AI message.')
    } finally {
      setIsBusy(false)
      refresh()
    }
  }, [ensureChat, input, plugin, refresh])

  const prompt = React.useCallback(
    async (title: string, initialValue = ''): Promise<string | null> => {
      return new PromptModal(plugin.app, title, initialValue).openAndWait()
    },
    [plugin]
  )

  const renameChat = React.useCallback(
    async (chatId: string) => {
      const chat = plugin.repository.getChat(chatId)
      if (!chat) {
        return
      }
      const title = await prompt('Rename chat', chat.title)
      if (!title) {
        return
      }
      await plugin.repository.renameChat(chatId, title)
    },
    [plugin, prompt]
  )

  const addMemory = React.useCallback(async () => {
    const fact = await prompt('Add memory fact')
    if (!fact) {
      return
    }
    await plugin.repository.addMemoryFact(fact, 'manual')
  }, [plugin, prompt])

  const editMemory = React.useCallback(
    async (factId: string) => {
      const fact = plugin.repository.getMemoryFacts().find((item) => item.id === factId)
      if (!fact) {
        return
      }
      const nextValue = await prompt('Edit memory fact', fact.fact)
      if (!nextValue) {
        return
      }
      await plugin.repository.updateMemoryFact(factId, nextValue)
    },
    [plugin, prompt]
  )

  return (
    <div className="noteva-ai-agent-shell">
      <ChatListPanel
        chats={filteredChats}
        activeChatId={activeChatId}
        search={search}
        onSearchChange={setSearch}
        onCreateChat={() => {
          void plugin.repository.createChat()
        }}
        onSelectChat={(chatId) => {
          void plugin.repository.setActiveChat(chatId)
        }}
        onRenameChat={(chatId) => {
          void renameChat(chatId)
        }}
        onDeleteChat={(chatId) => {
          void plugin.repository.deleteChat(chatId)
        }}
        onDeleteAllChats={() => {
          void plugin.repository.deleteAllChats()
        }}
      />

      <section className="noteva-ai-agent-main">
        <div className="noteva-ai-toolbar">
          <div>
            <strong>{activeChat?.title ?? 'Noteva AI Agent'}</strong>
            <div className="noteva-ai-toolbar-subtitle">
              {activeFilePath ? `Active note: ${activeFilePath}` : 'No active note'} <span aria-hidden="true">·</span> Context mode: {contextLabel}
            </div>
          </div>
          <div className="noteva-ai-toolbar-actions">
            <button
              type="button"
              onClick={() => {
                if (lastUserMessage) {
                  setInput(lastUserMessage.content)
                }
              }}
              disabled={!lastUserMessage}
            >
              Reuse prompt
            </button>
            <button type="button" onClick={() => plugin.openSettingsTab()}>
              Settings
            </button>
            <button
              type="button"
              onClick={() => {
                if (!activeChatId) {
                  return
                }
                void plugin.repository.clearChatHistory(activeChatId)
              }}
              disabled={!activeChatId}
            >
              Clear chat
            </button>
          </div>
        </div>

        <ChatMessagesPanel messages={activeChat?.messages ?? []} contextLabel={contextLabel} memoryEnabled={memoryEnabled} />

        <InputBar
          value={input}
          disabled={isBusy}
          isStreaming={plugin.agent.isStreaming()}
          selectedModel={plugin.getResolvedModel()}
          onChange={setInput}
          onSend={() => void send()}
          onStop={() => plugin.agent.stop()}
        />
      </section>

      <MemoryPanel
        facts={memoryFacts}
        enabled={memoryEnabled}
        onAdd={() => {
          void addMemory()
        }}
        onEdit={(factId) => {
          void editMemory(factId)
        }}
        onDelete={(factId) => {
          void plugin.repository.deleteMemoryFact(factId)
        }}
        onClear={() => {
          void plugin.repository.clearMemory()
        }}
      />
    </div>
  )
}

export class AIChatView extends ItemView {
  private root: Root | null = null

  constructor(leaf: WorkspaceLeaf, private readonly plugin: NotevaAIAgentPlugin) {
    super(leaf)
  }

  public override getViewType(): string {
    return VIEW_TYPE_AI_AGENT
  }

  public override getDisplayText(): string {
    return 'Noteva AI Agent'
  }

  public override getIcon(): string {
    return 'bot'
  }

  public override async onOpen(): Promise<void> {
    this.contentEl.empty()
    this.contentEl.addClass('noteva-ai-agent-view')
    const mount = this.contentEl.createDiv({ cls: 'noteva-ai-agent-root' })
    this.root = createRoot(mount)
    this.root.render(<AgentApp plugin={this.plugin} />)
  }

  public override async onClose(): Promise<void> {
    this.root?.unmount()
    this.root = null
  }
}
