export const estimateTokens = (text: string): number => {
  const trimmed = text.trim()
  if (!trimmed) {
    return 0
  }

  return Math.ceil(trimmed.length / 4)
}

export const truncateToBudget = (text: string, tokenBudget: number): string => {
  const approximateChars = Math.max(0, tokenBudget * 4)
  if (text.length <= approximateChars) {
    return text
  }

  return `${text.slice(0, approximateChars)}\n\n[Context truncated to fit token budget.]`
}
