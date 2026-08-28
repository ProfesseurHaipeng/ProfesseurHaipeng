import type { SiteContent } from "./types"

export function isSiteContent(value: unknown): value is SiteContent {
  if (!value || typeof value !== "object") return false
  const doc = value as SiteContent
  return (
    doc.schemaVersion === 1 &&
    typeof doc.settings?.productName === "string" &&
    Array.isArray(doc.nav) &&
    typeof doc.hero?.title === "string" &&
    Array.isArray(doc.solutions?.schemes) &&
    Array.isArray(doc.market?.groups)
  )
}
