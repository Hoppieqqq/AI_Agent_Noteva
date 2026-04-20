import { TFile, type App, type CachedMetadata } from 'obsidian'
import type { IndexedNote } from '../types'
import { extractWikilinks } from '../utils/wikilinkParser'

export class VaultIndexService {
  private notes = new Map<string, IndexedNote>()
  private backlinks = new Map<string, Set<string>>()

  constructor(private readonly app: App) {}

  public async rebuild(): Promise<void> {
    this.notes.clear()
    this.backlinks.clear()

    const files = this.app.vault.getMarkdownFiles()
    for (const file of files) {
      const indexed = await this.indexFile(file)
      this.notes.set(file.path, indexed)
    }

    for (const note of this.notes.values()) {
      for (const link of note.links) {
        const target = this.resolveTargetPath(link)
        if (!target) {
          continue
        }
        if (!this.backlinks.has(target)) {
          this.backlinks.set(target, new Set())
        }
        this.backlinks.get(target)?.add(note.path)
      }
    }

    for (const [path, note] of this.notes.entries()) {
      this.notes.set(path, { ...note, backlinks: [...(this.backlinks.get(path) ?? new Set())] })
    }
  }

  public getAllNotes(): IndexedNote[] {
    return [...this.notes.values()]
  }

  public getNote(path: string): IndexedNote | null {
    return this.notes.get(path) ?? null
  }

  public async refreshFile(path: string): Promise<void> {
    const abstract = this.app.vault.getAbstractFileByPath(path)
    if (!(abstract instanceof TFile)) {
      this.notes.delete(path)
      await this.rebuild()
      return
    }
    const indexed = await this.indexFile(abstract)
    this.notes.set(path, indexed)
    await this.rebuild()
  }

  public removeFile(path: string): void {
    this.notes.delete(path)
  }

  private async indexFile(file: TFile): Promise<IndexedNote> {
    const content = await this.app.vault.cachedRead(file)
    const cache = this.app.metadataCache.getFileCache(file)
    return {
      path: file.path,
      basename: file.basename,
      title: file.basename,
      folder: file.parent?.path ?? '',
      tags: this.extractTags(cache),
      links: this.extractLinks(cache, content),
      backlinks: [],
      headings: (cache?.headings ?? []).map((heading) => heading.heading),
      frontmatter: { ...(cache?.frontmatter ?? {}) },
      content,
      modifiedTime: file.stat.mtime
    }
  }

  private extractTags(cache: CachedMetadata | null): string[] {
    const tags = new Set<string>()
    for (const item of cache?.tags ?? []) {
      tags.add(item.tag)
    }
    if (cache?.frontmatter && Array.isArray(cache.frontmatter.tags)) {
      for (const tag of cache.frontmatter.tags) {
        if (typeof tag === 'string') {
          tags.add(tag.startsWith('#') ? tag : `#${tag}`)
        }
      }
    }
    return [...tags]
  }

  private extractLinks(cache: CachedMetadata | null, content: string): string[] {
    const links = new Set<string>()
    for (const item of cache?.links ?? []) {
      if (item.link) {
        links.add(item.link)
      }
    }
    for (const item of cache?.embeds ?? []) {
      if (item.link) {
        links.add(item.link)
      }
    }
    for (const item of extractWikilinks(content)) {
      links.add(item)
    }
    return [...links]
  }

  private resolveTargetPath(link: string): string | null {
    const destination = this.app.metadataCache.getFirstLinkpathDest(link, '')
    return destination?.path ?? null
  }
}

