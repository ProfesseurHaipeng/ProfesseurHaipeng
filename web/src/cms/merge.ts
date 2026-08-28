import { cloneJson } from "./clone"
import { defaultContent } from "./defaultContent"
import type { SiteContent } from "./types"

function hasId(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === "object" && "id" in value && typeof value.id === "string")
}

function mergeValue(base: unknown, incoming: unknown): unknown {
  if (incoming === undefined) return cloneJson(base)
  if (Array.isArray(base)) {
    if (!Array.isArray(incoming)) return cloneJson(base)
    if (base.length > 0 && hasId(base[0])) {
      const incomingItems = incoming.filter(hasId)
      const used = new Set(incomingItems.map((item) => item.id))
      const merged = incomingItems.map((item) => {
        const match = base.find((entry) => hasId(entry) && entry.id === item.id)
        return match ? mergeValue(match, item) : item
      })
      for (const entry of base) {
        if (hasId(entry) && !used.has(entry.id)) merged.push(cloneJson(entry))
      }
      return merged
    }
    return incoming
  }
  if (base && typeof base === "object") {
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      return cloneJson(base)
    }
    const next: Record<string, unknown> = { ...(base as Record<string, unknown>) }
    for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
      next[key] = key in next ? mergeValue(next[key], value) : value
    }
    return next
  }
  return incoming
}

export function mergeContent(partial: unknown, base: SiteContent = defaultContent): SiteContent {
  const merged = mergeValue(base, partial) as SiteContent
  merged.schemaVersion = 1
  if (!merged.updatedAt) merged.updatedAt = base.updatedAt
  return merged
}
