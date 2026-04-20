import type { TFile } from 'obsidian'
import type { AgentSettings, ContextBuildResult, IndexedNote } from '../types'
import { estimateTokens, truncateToBudget } from '../utils/tokenizer'
import { stripMarkdown } from '../utils/markdown'
import { GraphService } from './GraphService'
import { VaultIndexService } from './VaultIndexService'

export class ContextBuilder {
  constructor(
    private readonly index: VaultIndexService,
    private readonly graph: GraphService
  ) {}

  public async build(params: { settings: AgentSettings; activeFile: TFile | null }): Promise<ContextBuildResult> {
    const { settings, activeFile } = params

    let notes: IndexedNote[] = []
    let label = 'No vault context'

    switch (settings.contextMode) {
      case 'none':
        notes = []
        label = 'No context'
        break
      case 'current-note':
        notes = activeFile ? this.pickCurrent(activeFile.path) : []
        label = activeFile ? `Current note: ${activeFile.basename}` : 'Current note unavailable'
        break
      case 'current-note-linked':
        notes = activeFile ? [...this.pickCurrent(activeFile.path), ...this.graph.getLinkedNotes(activeFile.path, settings.graphDepth)] : []
        label = activeFile ? `Current note + linked notes (depth ${settings.graphDepth})` : 'Current note unavailable'
        break
      case 'current-note-backlinks':
        notes = activeFile ? [...this.pickCurrent(activeFile.path), ...this.graph.getBacklinks(activeFile.path)] : []
        label = activeFile ? 'Current note + backlinks' : 'Current note unavailable'
        break
      case 'folder':
        notes = activeFile ? this.index.getAllNotes().filter((note) => note.folder === (activeFile.parent?.path ?? '')) : []
        label = activeFile?.parent?.path ? `Folder: ${activeFile.parent.path}` : 'Folder unavailable'
        break
      case 'vault':
        notes = this.index.getAllNotes().slice().sort((a, b) => b.modifiedTime - a.modifiedTime).slice(0, 30)
        label = 'Vault-wide context'
        break
      case 'graph-neighborhood':
        notes = activeFile ? [...this.pickCurrent(activeFile.path), ...this.graph.getLinkedNotes(activeFile.path, settings.graphDepth), ...this.graph.getBacklinks(activeFile.path)] : []
        label = activeFile ? `Graph neighborhood around ${activeFile.basename}` : 'Graph neighborhood unavailable'
        break
    }

    const uniqueNotes = [...new Map(notes.map((note) => [note.path, note])).values()]
    const serialized = uniqueNotes
      .map((note) => `# ${note.title}\nPath: ${note.path}\nTags: ${note.tags.join(', ')}\nLinks: ${note.links.join(', ')}\nBacklinks: ${note.backlinks.join(', ')}\n\n${stripMarkdown(note.content)}`)
      .join('\n\n---\n\n')

    const contextText = truncateToBudget(serialized, settings.tokenBudget)
    return {
      mode: settings.contextMode,
      label,
      notes: uniqueNotes,
      contextText,
      estimatedTokens: estimateTokens(contextText)
    }
  }

  private pickCurrent(path: string): IndexedNote[] {
    const note = this.index.getNote(path)
    return note ? [note] : []
  }
}
