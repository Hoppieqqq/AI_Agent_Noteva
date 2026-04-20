import { App, Modal, Setting } from 'obsidian'
import type { WriteConfirmationRequest } from '../types'

export class ConfirmWriteModal extends Modal {
  private resolvePromise: ((accepted: boolean) => void) | null = null

  constructor(
    app: App,
    private readonly request: WriteConfirmationRequest
  ) {
    super(app)
  }

  public openAndWait(): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve
      this.open()
    })
  }

  public override onOpen(): void {
    const { contentEl } = this
    contentEl.empty()
    contentEl.createEl('h3', { text: this.request.action === 'create' ? 'Confirm note creation' : 'Confirm note update' })
    contentEl.createEl('p', { text: `Path: ${this.request.path}` })
    const preview = contentEl.createEl('pre')
    preview.setText(this.request.contentPreview)

    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText('Cancel').onClick(() => {
          this.finish(false)
        })
      )
      .addButton((button) =>
        button
          .setButtonText('Confirm')
          .setCta()
          .onClick(() => {
            this.finish(true)
          })
      )
  }

  public override onClose(): void {
    this.contentEl.empty()
    if (this.resolvePromise) {
      this.resolvePromise(false)
      this.resolvePromise = null
    }
  }

  private finish(accepted: boolean): void {
    const resolve = this.resolvePromise
    this.resolvePromise = null
    this.close()
    resolve?.(accepted)
  }
}
