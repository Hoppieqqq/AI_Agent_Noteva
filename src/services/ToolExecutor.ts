import { TFile } from 'obsidian'
import type { App } from 'obsidian'
import type { ToolCall, ToolDefinition, WriteConfirmationRequest } from '../types'
import { GraphService } from './GraphService'
import { VaultIndexService } from './VaultIndexService'

const parseArguments = (raw: string): Record<string, unknown> => {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

export class ToolExecutor {
  private readonly definitions: ToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'find_related_notes',
        description: 'Find notes related to a query using graph and content relevance.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            topN: { type: 'number' }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_backlinks',
        description: 'Get backlinks for a note path.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'build_topic_map',
        description: 'Build a compact topic map of the most relevant notes for a query.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            topN: { type: 'number' }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'suggest_wikilinks',
        description: 'Suggest missing wikilinks for a note path.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            limit: { type: 'number' }
          },
          required: ['path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'find_orphan_notes',
        description: 'Find notes without incoming or outgoing wiki links.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_moc_note',
        description: 'Create a map-of-content note that summarizes related notes for a query.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            title: { type: 'string' },
            query: { type: 'string' }
          },
          required: ['path', 'title', 'query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_note',
        description: 'Create a markdown note in the vault.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['path', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'append_to_note',
        description: 'Append markdown content to an existing note.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['path', 'content']
        }
      }
    }
  ]

  constructor(
    private readonly app: App,
    private readonly graph: GraphService,
    private readonly index: VaultIndexService,
    private readonly shouldConfirmWrites: () => boolean,
    private readonly confirmWrite: (request: WriteConfirmationRequest) => Promise<boolean>
  ) {}

  public getDefinitions(): ToolDefinition[] {
    return this.definitions
  }

  public async execute(toolCall: ToolCall): Promise<string> {
    const args = parseArguments(toolCall.function.arguments)

    switch (toolCall.function.name) {
      case 'find_related_notes': {
        const query = typeof args.query === 'string' ? args.query : ''
        const topN = typeof args.topN === 'number' ? args.topN : 8
        return JSON.stringify(this.graph.getSubgraphByTopic(query, topN))
      }
      case 'get_backlinks': {
        const path = typeof args.path === 'string' ? args.path : ''
        return JSON.stringify(this.graph.getBacklinks(path).map((note) => ({ path: note.path, title: note.title })))
      }
      case 'build_topic_map': {
        const query = typeof args.query === 'string' ? args.query : ''
        const topN = typeof args.topN === 'number' ? args.topN : 10
        const topicNotes = this.graph.getSubgraphByTopic(query, topN)
        return JSON.stringify({
          query,
          related: topicNotes,
          hubs: this.graph.getHubNotes(5).map((note) => ({ path: note.path, title: note.title }))
        })
      }
      case 'suggest_wikilinks': {
        const path = typeof args.path === 'string' ? args.path : ''
        const limit = typeof args.limit === 'number' ? args.limit : 8
        return JSON.stringify(this.graph.suggestWikilinks(path, limit))
      }
      case 'find_orphan_notes': {
        return JSON.stringify(this.graph.getOrphans().map((note) => ({ path: note.path, title: note.title })))
      }
      case 'create_moc_note': {
        const path = typeof args.path === 'string' ? args.path : ''
        const title = typeof args.title === 'string' ? args.title : 'Map of content'
        const query = typeof args.query === 'string' ? args.query : ''
        const related = this.graph.getSubgraphByTopic(query, 12)
        const body = [
          `# ${title}`,
          '',
          `Generated topic map for: ${query}`,
          '',
          ...related.map((item) => `- [[${item.title}]]`)
        ].join('\n')
        await this.createNoteWithConfirmation(path, body)
        return JSON.stringify({ success: true, path, relatedCount: related.length })
      }
      case 'create_note': {
        const path = typeof args.path === 'string' ? args.path : ''
        const content = typeof args.content === 'string' ? args.content : ''
        await this.createNoteWithConfirmation(path, content)
        return JSON.stringify({ success: true, path })
      }
      case 'append_to_note': {
        const path = typeof args.path === 'string' ? args.path : ''
        const content = typeof args.content === 'string' ? args.content : ''
        await this.appendNoteWithConfirmation(path, content)
        return JSON.stringify({ success: true, path })
      }
      default:
        throw new Error(`Unsupported tool: ${toolCall.function.name}`)
    }
  }

  private async createNoteWithConfirmation(path: string, content: string): Promise<void> {
    if (!path || !content.trim()) {
      throw new Error('Missing note path or content')
    }

    if (this.shouldConfirmWrites()) {
      const accepted = await this.confirmWrite({
        action: 'create',
        path,
        contentPreview: content.slice(0, 1200)
      })
      if (!accepted) {
        throw new Error('AI note creation was cancelled by the user')
      }
    }

    await this.ensureParentFolder(path)
    await this.app.vault.create(path, content)
  }

  private async appendNoteWithConfirmation(path: string, content: string): Promise<void> {
    if (!path || !content.trim()) {
      throw new Error('Missing note path or content')
    }

    const abstract = this.app.vault.getAbstractFileByPath(path)
    if (!(abstract instanceof TFile)) {
      throw new Error(`Note not found: ${path}`)
    }

    if (this.shouldConfirmWrites()) {
      const accepted = await this.confirmWrite({
        action: 'append',
        path,
        contentPreview: content.slice(0, 1200)
      })
      if (!accepted) {
        throw new Error('AI note update was cancelled by the user')
      }
    }

    const current = await this.app.vault.read(abstract)
    await this.app.vault.modify(abstract, `${current}\n\n${content}`)
  }

  private async ensureParentFolder(path: string): Promise<void> {
    const parts = path.split('/').slice(0, -1).filter(Boolean)
    if (parts.length === 0) {
      return
    }

    let current = ''
    for (const part of parts) {
      current = current ? `${current}/${part}` : part
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current)
      }
    }
  }
}
