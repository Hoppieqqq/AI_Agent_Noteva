const WIKILINK_PATTERN = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g

export const extractWikilinks = (markdown: string): string[] => {
  const results = new Set<string>()

  for (const match of markdown.matchAll(WIKILINK_PATTERN)) {
    const raw = match[1]?.trim()
    if (raw) {
      results.add(raw)
    }
  }

  return [...results]
}
