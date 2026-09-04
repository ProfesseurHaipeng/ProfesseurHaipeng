const FALLBACK_ALIASES = ["hermes", "linda", "weho", "minimax", "nas"]

export function parseProjectIdentityDenylist(raw?: string): string[] {
  const text = raw?.trim() || ""
  if (!text) return []
  try {
    const parsed = JSON.parse(text) as unknown
    const terms: string[] = []
    const take = (value: unknown) => {
      if (typeof value === "string" && value.trim()) terms.push(value.trim())
      else if (Array.isArray(value)) value.forEach(take)
      else if (value && typeof value === "object") Object.values(value).forEach(take)
    }
    take(parsed)
    return [...new Set(terms)]
  } catch {
    return []
  }
}

export function stripDeniedIdentities(text: string, extra: string[] = []) {
  const terms = [...extra, ...FALLBACK_ALIASES]
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .sort((a, b) => b.length - a.length)
  let out = text
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    out = out.replace(new RegExp(escaped, "gi"), "Karmenai")
  }
  return out.replace(/Karmenai(?:[、,]\s*)?Karmenai/g, "Karmenai")
}
