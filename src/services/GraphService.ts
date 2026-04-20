import type { IndexedNote, RelatedNoteSummary } from '../types'
import { VaultIndexService } from './VaultIndexService'

export class GraphService {
  constructor(private readonly index: VaultIndexService) {}

  public getLinkedNotes(path: string, depth = 1): IndexedNote[] {
    const allNotes = this.index.getAllNotes()
    const lookup = new Map(allNotes.map((note) => [note.path, note] as const))
    const visited = new Set<string>([path])
    const queue: Array<{ path: string; depth: number }> = [{ path, depth: 0 }]
    const results: IndexedNote[] = []

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) {
        continue
      }
      const note = lookup.get(current.path)
      if (!note) {
        continue
      }
      if (current.depth > 0) {
        results.push(note)
      }
      if (current.depth >= depth) {
        continue
      }
      for (const link of note.links) {
        const target = allNotes.find((item) => item.basename === link || item.path === link)
        if (!target || visited.has(target.path)) {
          continue
        }
        visited.add(target.path)
        queue.push({ path: target.path, depth: current.depth + 1 })
      }
    }

    return results
  }

  public getBacklinks(path: string): IndexedNote[] {
    const note = this.index.getNote(path)
    if (!note) {
      return []
    }

    return note.backlinks.map((item) => this.index.getNote(item)).filter((item): item is IndexedNote => Boolean(item))
  }

  public getOrphans(): IndexedNote[] {
    return this.index.getAllNotes().filter((note) => note.links.length === 0 && note.backlinks.length === 0)
  }

  public getHubNotes(topN = 10): IndexedNote[] {
    return this.index
      .getAllNotes()
      .slice()
      .sort((a, b) => b.links.length + b.backlinks.length - (a.links.length + a.backlinks.length))
      .slice(0, topN)
  }

  public getSubgraphByTopic(query: string, topN = 10): RelatedNoteSummary[] {
    const normalized = query.toLowerCase()
    return this.index
      .getAllNotes()
      .map((note) => {
        const haystack = `${note.title}\n${note.content}\n${note.tags.join(' ')}\n${note.links.join(' ')}`.toLowerCase()
        const score = haystack.includes(normalized) ? 10 : 0
        const tagHits = note.tags.filter((tag) => tag.toLowerCase().includes(normalized)).length
        const backlinkWeight = note.backlinks.length * 0.2
        const linkWeight = note.links.filter((link) => link.toLowerCase().includes(normalized)).length * 1.5
        return { path: note.path, title: note.title, score: score + tagHits * 2 + backlinkWeight + linkWeight }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
  }

  public getPathBetween(startPath: string, endPath: string): string[] | null {
    if (startPath === endPath) {
      return [startPath]
    }

    const allNotes = this.index.getAllNotes()
    const queue: string[] = [startPath]
    const parent = new Map<string, string | null>([[startPath, null]])

    while (queue.length > 0) {
      const currentPath = queue.shift()
      if (!currentPath) {
        continue
      }
      const linked = this.getLinkedNotes(currentPath, 1)
      const backlinks = this.getBacklinks(currentPath)
      const neighbors = [...linked, ...backlinks]

      for (const neighbor of neighbors) {
        if (parent.has(neighbor.path)) {
          continue
        }
        parent.set(neighbor.path, currentPath)
        if (neighbor.path === endPath) {
          const result: string[] = [endPath]
          let cursor: string | null = currentPath
          while (cursor) {
            result.unshift(cursor)
            cursor = parent.get(cursor) ?? null
          }
          return result
        }
        queue.push(neighbor.path)
      }
    }

    if (!allNotes.find((note) => note.path === endPath)) {
      return null
    }

    return null
  }

  public suggestWikilinks(path: string, limit = 8): RelatedNoteSummary[] {
    const note = this.index.getNote(path)
    if (!note) {
      return []
    }

    const existing = new Set(note.links.map((link) => link.toLowerCase()))
    const currentTerms = `${note.title}\n${note.content}`.toLowerCase()

    return this.index
      .getAllNotes()
      .filter((candidate) => candidate.path !== path)
      .map((candidate) => {
        if (existing.has(candidate.basename.toLowerCase()) || existing.has(candidate.path.toLowerCase())) {
          return null
        }

        let score = 0
        if (currentTerms.includes(candidate.basename.toLowerCase())) {
          score += 5
        }

        const sharedTags = candidate.tags.filter((tag) => note.tags.includes(tag)).length
        score += sharedTags * 2
        score += candidate.backlinks.includes(path) ? 3 : 0

        return score > 0 ? { path: candidate.path, title: candidate.title, score } : null
      })
      .filter((item): item is RelatedNoteSummary => Boolean(item))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}
