import type { App } from 'obsidian'
import { SECRET_ID_OPENROUTER_API_KEY } from '../constants'

const encodeFallback = (value: string): string => Buffer.from(value, 'utf8').toString('base64')
const decodeFallback = (value: string): string => Buffer.from(value, 'base64').toString('utf8')

export class SecretStorageService {
  constructor(private readonly app: App) {}

  public getApiKey(): string {
    if (this.app.secretStorage) {
      return this.app.secretStorage.getSecret(SECRET_ID_OPENROUTER_API_KEY) ?? ''
    }

    const fallback = this.app.loadLocalStorage(SECRET_ID_OPENROUTER_API_KEY)
    return fallback ? decodeFallback(fallback) : ''
  }

  public setApiKey(value: string): void {
    if (this.app.secretStorage) {
      this.app.secretStorage.setSecret(SECRET_ID_OPENROUTER_API_KEY, value.trim())
      return
    }

    this.app.saveLocalStorage(SECRET_ID_OPENROUTER_API_KEY, value.trim() ? encodeFallback(value.trim()) : null)
  }
}
