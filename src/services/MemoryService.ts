import { ChatRepository } from './ChatRepository'

export class MemoryService {
  constructor(private readonly repository: ChatRepository) {}

  public list() {
    return this.repository.getMemoryFacts()
  }

  public async addManualFact(fact: string) {
    return this.repository.addMemoryFact(fact, 'manual')
  }

  public async remove(id: string) {
    await this.repository.deleteMemoryFact(id)
  }

  public async clear() {
    await this.repository.clearMemory()
  }

  public async extractFromConversation(transcript: string): Promise<void> {
    const lines = transcript
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 20)
      .slice(0, 3)

    for (const line of lines) {
      await this.repository.addMemoryFact(line, 'extracted')
    }
  }

  public buildPromptBlock(): string {
    const facts = this.repository.getMemoryFacts()
    if (facts.length === 0) {
      return ''
    }

    return `Known memory facts:\n${facts.map((fact) => `- ${fact.fact}`).join('\n')}`
  }
}
