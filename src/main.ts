import { Editor, MarkdownView, Notice, Plugin, WorkspaceLeaf } from 'obsidian'
import { COMMAND_IDS, PLUGIN_NAME, VIEW_TYPE_AI_AGENT } from './constants'
import { ContextBuilder } from './services/ContextBuilder'
import { GraphService } from './services/GraphService'
import { MemoryService } from './services/MemoryService'
import { OpenRouterService } from './services/OpenRouterService'
import { SecretStorageService } from './services/SecretStorage'
import { ToolExecutor } from './services/ToolExecutor'
import { VaultIndexService } from './services/VaultIndexService'
import { ChatRepository } from './services/ChatRepository'
import { AgentService } from './services/AgentService'
import { AISettingTab } from './settings/AISettingTab'
import { AIChatView } from './ui/AIChatView'
import { ConfirmWriteModal } from './ui/ConfirmWriteModal'
import type { AgentSettings, ModelOption, PluginDataShape, WriteConfirmationRequest } from './types'

interface InternalSettingsManager {
  open(): void
  openTabById(id: string): void
}

export default class NotevaAIAgentPlugin extends Plugin {
  public repository!: ChatRepository
  public secretStorage!: SecretStorageService
  public vaultIndex!: VaultIndexService
  public graph!: GraphService
  public contextBuilder!: ContextBuilder
  public memory!: MemoryService
  public openRouter!: OpenRouterService
  public toolExecutor!: ToolExecutor
  public agent!: AgentService
  private modelCache: ModelOption[] = []

  public override onload(): void {
    void this.initialize()
  }

  public override onunload(): void {
    this.agent?.stop()
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_AI_AGENT)
  }

  public getResolvedModel(): string {
    const settings = this.repository.getSettings()
    return settings.manualModelOverride.trim() || settings.defaultModel
  }

  public getCachedModels(): ModelOption[] {
    return [...this.modelCache]
  }

  public getActiveSelection(): string | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    if (!view) {
      return null
    }
    const editor: Editor = view.editor
    const selection = editor.getSelection().trim()
    return selection || null
  }

  public async updateSettings(patch: Partial<AgentSettings>): Promise<void> {
    await this.repository.updateSettings(patch)
  }

  public async rebuildIndex(): Promise<void> {
    await this.vaultIndex.rebuild()
  }

  public async activateFromSettings(): Promise<void> {
    await this.activateView()
  }

  public async refreshModels(): Promise<ModelOption[]> {
    const apiKey = this.secretStorage.getApiKey()
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured')
    }
    this.modelCache = await this.openRouter.listModels(apiKey)
    return this.getCachedModels()
  }

  public async testConnection(): Promise<void> {
    const apiKey = this.secretStorage.getApiKey()
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured')
    }
    await this.openRouter.testConnection(apiKey, this.getResolvedModel())
  }

  public openSettingsTab(): void {
    const settingsManager = (this.app as typeof this.app & { setting?: InternalSettingsManager }).setting
    settingsManager?.open()
    settingsManager?.openTabById(this.manifest.id)
  }

  private async initialize(): Promise<void> {
    this.secretStorage = new SecretStorageService(this.app)
    this.repository = new ChatRepository(() => this.loadData(), (data: PluginDataShape) => this.saveData(data))
    await this.repository.initialize()

    this.vaultIndex = new VaultIndexService(this.app)
    await this.vaultIndex.rebuild()

    this.graph = new GraphService(this.vaultIndex)
    this.contextBuilder = new ContextBuilder(this.vaultIndex, this.graph)
    this.memory = new MemoryService(this.repository)
    this.openRouter = new OpenRouterService()
    this.toolExecutor = new ToolExecutor(
      this.app,
      this.graph,
      this.vaultIndex,
      () => this.repository.getSettings().confirmBeforeWritingNotes,
      (request) => this.confirmWriteRequest(request)
    )
    this.agent = new AgentService(
      this.repository,
      this.openRouter,
      this.contextBuilder,
      this.memory,
      this.toolExecutor,
      () => this.app.workspace.getActiveFile(),
      () => this.secretStorage.getApiKey()
    )

    this.registerView(VIEW_TYPE_AI_AGENT, (leaf) => new AIChatView(leaf, this))
    this.addRibbonIcon('bot', 'Open Noteva AI Agent', () => {
      void this.activateView()
    })
    this.addSettingTab(new AISettingTab(this.app, this))
    this.registerCommands()
    this.registerEvents()

    if (this.secretStorage.getApiKey()) {
      void this.refreshModels().catch(() => {
        // Models will be loaded manually from settings if OpenRouter is unavailable.
      })
    }

    new Notice(`${PLUGIN_NAME} loaded.`)
  }

  private registerCommands(): void {
    this.addCommand({
      id: COMMAND_IDS.OPEN_VIEW,
      name: 'Open AI Agent',
      callback: () => {
        void this.activateView()
      }
    })

    this.addCommand({
      id: COMMAND_IDS.NEW_CHAT,
      name: 'New chat',
      callback: async () => {
        await this.repository.createChat()
        await this.activateView()
      }
    })

    this.addCommand({
      id: COMMAND_IDS.SUMMARIZE_CURRENT_NOTE,
      name: 'Summarize current note',
      callback: async () => {
        await this.quickPrompt('Summarize the current note and highlight key insights.')
      }
    })

    this.addCommand({
      id: COMMAND_IDS.EXPLAIN_SELECTION,
      name: 'Explain selection',
      editorCallback: async () => {
        await this.quickPrompt('Explain the current text selection clearly and concisely.')
      }
    })

    this.addCommand({
      id: COMMAND_IDS.FIND_RELATED_NOTES,
      name: 'Find related notes',
      callback: async () => {
        await this.quickPrompt('Find related notes for the current note and explain the connections.')
      }
    })
  }

  private registerEvents(): void {
    this.registerEvent(this.app.metadataCache.on('changed', (file) => {
      void this.vaultIndex.refreshFile(file.path)
    }))

    this.registerEvent(this.app.vault.on('create', (file) => {
      if ('path' in file) {
        void this.vaultIndex.refreshFile(file.path)
      }
    }))

    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      this.vaultIndex.removeFile(oldPath)
      if ('path' in file) {
        void this.vaultIndex.refreshFile(file.path)
      }
    }))

    this.registerEvent(this.app.vault.on('delete', (file) => {
      if ('path' in file) {
        this.vaultIndex.removeFile(file.path)
      }
    }))
  }

  private async activateView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_AI_AGENT)
    let leaf = leaves[0] ?? undefined
    if (!leaf) {
      const createdLeaf = this.app.workspace.getLeftLeaf(false)
      if (!createdLeaf) {
        throw new Error('Could not acquire a workspace leaf for Noteva AI Agent.')
      }
      leaf = createdLeaf
      await leaf.setViewState({ type: VIEW_TYPE_AI_AGENT, active: true })
    }
    await this.app.workspace.revealLeaf(leaf)
  }

  private async quickPrompt(prompt: string): Promise<void> {
    let finalPrompt = prompt
    const selection = this.getActiveSelection()
    if (selection) {
      finalPrompt = `${prompt}\n\nSelection:\n${selection}`
    }

    let chat = this.repository.getActiveChatId() ? this.repository.getChat(this.repository.getActiveChatId() as string) : null
    if (!chat) {
      chat = await this.repository.createChat()
    }

    try {
      await this.agent.sendMessage({
        chatId: chat.id,
        message: finalPrompt,
        activeFilePath: this.app.workspace.getActiveFile()?.path ?? null,
        selection
      })
      await this.activateView()
    } catch (error) {
      new Notice(error instanceof Error ? error.message : 'AI action failed.')
    }
  }

  private async confirmWriteRequest(request: WriteConfirmationRequest): Promise<boolean> {
    const modal = new ConfirmWriteModal(this.app, request)
    return modal.openAndWait()
  }
}
