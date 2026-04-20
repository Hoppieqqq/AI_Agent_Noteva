import { Notice, PluginSettingTab, SecretComponent, Setting } from 'obsidian'
import type { App } from 'obsidian'
import type NotevaAIAgentPlugin from '../main'
import type { AIContextMode, ModelOption } from '../types'

const CONTEXT_OPTIONS: Array<{ value: AIContextMode; label: string }> = [
  { value: 'none', label: 'No context' },
  { value: 'current-note', label: 'Current note' },
  { value: 'current-note-linked', label: 'Current note + linked notes' },
  { value: 'current-note-backlinks', label: 'Current note + backlinks' },
  { value: 'folder', label: 'Current folder' },
  { value: 'vault', label: 'Vault-wide' },
  { value: 'graph-neighborhood', label: 'Graph neighborhood' }
]

const formatModelLabel = (model: ModelOption): string => {
  const context = model.contextLength ? ` · ${model.contextLength.toLocaleString()} ctx` : ''
  return `${model.name}${context}`
}

export class AISettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: NotevaAIAgentPlugin) {
    super(app, plugin)
  }

  public display(): void {
    const { containerEl } = this
    const settings = this.plugin.repository.getSettings()
    const cachedModels = this.plugin.getCachedModels()
    containerEl.empty()

    const apiKeySetting = new Setting(containerEl)
      .setName('OpenRouter API key')
      .setDesc('Stored in Obsidian secret storage when available.')

    apiKeySetting.controlEl.empty()
    const secret = new SecretComponent(this.app, apiKeySetting.controlEl)
    secret.setValue(this.plugin.secretStorage.getApiKey())
    secret.onChange((value) => {
      this.plugin.secretStorage.setApiKey(value)
    })

    new Setting(containerEl)
      .setName('Available models')
      .setDesc('Refresh the OpenRouter model list and choose a default model.')
      .addDropdown((dropdown) => {
        if (cachedModels.length === 0) {
          dropdown.addOption(settings.defaultModel, settings.defaultModel)
        } else {
          for (const model of cachedModels) {
            dropdown.addOption(model.id, formatModelLabel(model))
          }
          if (!cachedModels.some((model) => model.id === settings.defaultModel)) {
            dropdown.addOption(settings.defaultModel, `${settings.defaultModel} (current)`)
          }
        }
        dropdown.setValue(settings.defaultModel)
        dropdown.onChange((value) => {
          void this.plugin.updateSettings({ defaultModel: value })
        })
      })
      .addButton((button) =>
        button.setButtonText('Refresh').onClick(async () => {
          try {
            await this.plugin.refreshModels()
            new Notice('OpenRouter models refreshed.')
            this.display()
          } catch (error) {
            new Notice(error instanceof Error ? error.message : 'Could not refresh models.')
          }
        })
      )

    new Setting(containerEl)
      .setName('Manual model override')
      .setDesc('Optional exact model ID. If set, it overrides the dropdown model.')
      .addText((text) =>
        text.setPlaceholder('openai/gpt-4.1-mini')
          .setValue(settings.manualModelOverride)
          .onChange((value) => {
            void this.plugin.updateSettings({ manualModelOverride: value.trim() })
          })
      )

    new Setting(containerEl)
      .setName('System prompt')
      .setDesc('Base instruction injected into every chat turn.')
      .addTextArea((text) =>
        text.setValue(settings.systemPrompt).onChange((value) => {
          void this.plugin.updateSettings({ systemPrompt: value })
        })
      )

    new Setting(containerEl)
      .setName('Context mode')
      .setDesc('Controls how much vault context the agent sees.')
      .addDropdown((dropdown) => {
        for (const option of CONTEXT_OPTIONS) {
          dropdown.addOption(option.value, option.label)
        }
        dropdown.setValue(settings.contextMode)
        dropdown.onChange((value) => {
          void this.plugin.updateSettings({ contextMode: value as AIContextMode })
        })
      })

    new Setting(containerEl)
      .setName('Graph depth')
      .setDesc('How deep linked-note traversal should go for graph-aware modes.')
      .addSlider((slider) =>
        slider.setLimits(1, 3, 1).setValue(settings.graphDepth).setDynamicTooltip().onChange((value) => {
          void this.plugin.updateSettings({ graphDepth: value })
        })
      )

    new Setting(containerEl)
      .setName('Token budget')
      .setDesc('Approximate maximum token budget for context assembly.')
      .addText((text) =>
        text.setPlaceholder('24000').setValue(String(settings.tokenBudget)).onChange((value) => {
          const parsed = Number(value)
          if (!Number.isFinite(parsed) || parsed < 1000) {
            return
          }
          void this.plugin.updateSettings({ tokenBudget: parsed })
        })
      )

    new Setting(containerEl)
      .setName('Streaming responses')
      .setDesc('Stream partial tokens into the chat UI while the model is responding.')
      .addToggle((toggle) => toggle.setValue(settings.streamingEnabled).onChange((value) => void this.plugin.updateSettings({ streamingEnabled: value })))

    new Setting(containerEl)
      .setName('Use tools')
      .setDesc('Allow note-aware tools such as finding related notes or creating notes.')
      .addToggle((toggle) => toggle.setValue(settings.useTools).onChange((value) => void this.plugin.updateSettings({ useTools: value })))

    new Setting(containerEl)
      .setName('Confirm before writing notes')
      .setDesc('Require approval before AI tools create or append note content.')
      .addToggle((toggle) =>
        toggle.setValue(settings.confirmBeforeWritingNotes).onChange((value) => void this.plugin.updateSettings({ confirmBeforeWritingNotes: value }))
      )

    new Setting(containerEl)
      .setName('Enable memory')
      .setDesc('Inject saved memory facts into the system prompt.')
      .addToggle((toggle) => toggle.setValue(settings.memoryEnabled).onChange((value) => void this.plugin.updateSettings({ memoryEnabled: value })))

    new Setting(containerEl)
      .setName('Auto-extract memory')
      .setDesc('Let the agent promote durable facts from conversations into memory.')
      .addToggle((toggle) => toggle.setValue(settings.autoExtractMemory).onChange((value) => void this.plugin.updateSettings({ autoExtractMemory: value })))

    new Setting(containerEl)
      .setName('Temperature')
      .setDesc('Higher values produce more exploratory responses.')
      .addSlider((slider) =>
        slider.setLimits(0, 1.2, 0.1).setValue(settings.temperature).setDynamicTooltip().onChange((value) => void this.plugin.updateSettings({ temperature: value }))
      )

    new Setting(containerEl)
      .setName('Max completion tokens')
      .setDesc('Upper bound for generated output tokens per response.')
      .addText((text) =>
        text.setPlaceholder('1400').setValue(String(settings.maxTokens)).onChange((value) => {
          const parsed = Number(value)
          if (!Number.isFinite(parsed) || parsed < 64) {
            return
          }
          void this.plugin.updateSettings({ maxTokens: parsed })
        })
      )

    new Setting(containerEl)
      .setName('Debug mode')
      .setDesc('Keep extra internal diagnostics available for troubleshooting.')
      .addToggle((toggle) => toggle.setValue(settings.debugMode).onChange((value) => void this.plugin.updateSettings({ debugMode: value })))

    new Setting(containerEl)
      .setName('Tool debug')
      .setDesc('Expose extra tool execution details during agent runs.')
      .addToggle((toggle) => toggle.setValue(settings.toolDebug).onChange((value) => void this.plugin.updateSettings({ toolDebug: value })))

    new Setting(containerEl)
      .setName('Open AI Agent view')
      .setDesc('Open the sidebar chat view immediately.')
      .addButton((button) =>
        button.setButtonText('Open').setCta().onClick(() => {
          void this.plugin.activateFromSettings()
        })
      )

    new Setting(containerEl)
      .setName('Rebuild vault index')
      .setDesc('Force a full rebuild of the graph-aware note index.')
      .addButton((button) =>
        button.setButtonText('Rebuild').onClick(async () => {
          await this.plugin.rebuildIndex()
          new Notice('Vault index rebuilt.')
        })
      )

    new Setting(containerEl)
      .setName('Test OpenRouter connection')
      .setDesc('Sends a small validation request using the current model settings.')
      .addButton((button) =>
        button.setButtonText('Test').onClick(async () => {
          try {
            await this.plugin.testConnection()
            new Notice('OpenRouter connection succeeded.')
          } catch (error) {
            new Notice(error instanceof Error ? error.message : 'OpenRouter test failed.')
          }
        })
      )
  }
}
