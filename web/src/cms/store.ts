import { cloneJson } from "./clone"
import { defaultContent } from "./defaultContent"
import { mergeContent } from "./merge"
import type { SiteContent } from "./types"
import { isSiteContent } from "./validate"
import { withBase } from "../lib/asset"

export const DRAFT_KEY = "ash-cms-draft"
export const PREVIEW_KEY = "ash-cms-preview"
export const SESSION_KEY = "ash-cms-session"

const listeners = new Set<() => void>()

export function subscribeContent(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit() {
  for (const listener of listeners) listener()
}

export function readDraft(): SiteContent | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isSiteContent(parsed) ? mergeContent(parsed) : null
  } catch {
    return null
  }
}

export function writeDraft(content: SiteContent) {
  const next = {
    ...cloneJson(content),
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
  emit()
  return next
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
  emit()
}

export function setPreviewDraft(on: boolean) {
  if (on) localStorage.setItem(PREVIEW_KEY, "1")
  else localStorage.removeItem(PREVIEW_KEY)
  emit()
}

export function isPreviewDraft() {
  if (typeof window === "undefined") return false
  if (localStorage.getItem(PREVIEW_KEY) === "1") return true
  return new URLSearchParams(window.location.search).get("preview") === "1"
}

export function publishedFallback() {
  return cloneJson(defaultContent)
}

export async function fetchPublished(): Promise<SiteContent> {
  try {
    const response = await fetch(withBase("api/content"), { headers: { Accept: "application/json" } })
    if (!response.ok) return publishedFallback()
    const parsed: unknown = await response.json()
    return isSiteContent(parsed) ? mergeContent(parsed) : publishedFallback()
  } catch {
    return publishedFallback()
  }
}

export function resolvePublicContent(published: SiteContent): SiteContent {
  if (isPreviewDraft()) {
    return readDraft() ?? published
  }
  return published
}

export async function publishContent(content: SiteContent, password: string) {
  const body = JSON.stringify({ password, content })
  const response = await fetch(withBase("api/content"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || "发布失败")
  }
}

export function downloadContent(content: SiteContent) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "site-content.json"
  link.click()
  URL.revokeObjectURL(url)
}

export async function readImportedFile(file: File): Promise<SiteContent> {
  const text = await file.text()
  const parsed: unknown = JSON.parse(text)
  if (!isSiteContent(parsed)) {
    throw new Error("这个文件不是本站的内容格式")
  }
  return mergeContent(parsed)
}
