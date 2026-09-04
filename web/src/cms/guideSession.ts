export type GuideChatTurn = { role: "user" | "assistant"; content: string }
export type GuideSessionAdvisor = "lin" | "hermes"
export type GuideSessionLang = "zh" | "en"

export type GuideSession = {
  visitorId: string
  turns: GuideChatTurn[]
  advisor: GuideSessionAdvisor
  lang: GuideSessionLang
  handoffIndex: number | null
  takenOver: boolean
  open?: boolean
  updatedAt: string
}

export const GUIDE_VISITOR_KEY = "ash-visitor-id"
export const GUIDE_SESSION_KEY = "ash-guide-session"
export const MAX_GUIDE_TURNS = 80
export const MAX_GUIDE_TURN_CHARS = 4000
export const GUIDE_IP_BIND_MS = 14 * 24 * 60 * 60 * 1000

export function hashVisitorSignal(value: string) {
  const clean = value.trim().toLowerCase()
  if (!clean) return ""
  let a = 2166136261
  for (let i = 0; i < clean.length; i += 1) {
    a ^= clean.charCodeAt(i)
    a = Math.imul(a, 16777619)
  }
  return (a >>> 0).toString(16).padStart(8, "0")
}

export function sanitizeVisitorId(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
}

export function asGuideTurns(raw: unknown): GuideChatTurn[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const row = item as { role?: unknown; content?: unknown }
      if (row.role !== "user" && row.role !== "assistant") return null
      if (typeof row.content !== "string" || !row.content.trim()) return null
      return { role: row.role, content: row.content.slice(0, MAX_GUIDE_TURN_CHARS) }
    })
    .filter((item): item is GuideChatTurn => Boolean(item))
    .slice(-MAX_GUIDE_TURNS)
}

export function hydrateGuideSession(raw: unknown, visitorId?: string): GuideSession | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<GuideSession>
  const id = sanitizeVisitorId(row.visitorId) || sanitizeVisitorId(visitorId)
  const turns = asGuideTurns(row.turns)
  if (!id || !turns.length) return null
  return {
    visitorId: id,
    turns,
    advisor: row.advisor === "hermes" ? "hermes" : "lin",
    lang: row.lang === "en" ? "en" : "zh",
    handoffIndex: typeof row.handoffIndex === "number" && row.handoffIndex >= 0 ? row.handoffIndex : null,
    takenOver: row.takenOver === true,
    open: row.open === true,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  }
}

export function readVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(GUIDE_VISITOR_KEY)
    if (existing) return sanitizeVisitorId(existing)
    const next = `vis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    window.localStorage.setItem(GUIDE_VISITOR_KEY, next)
    return next
  } catch {
    return ""
  }
}

export function rememberVisitorId(id: string) {
  const clean = sanitizeVisitorId(id)
  if (!clean) return
  try {
    window.localStorage.setItem(GUIDE_VISITOR_KEY, clean)
  } catch {
    /* private mode */
  }
}

export function loadGuideSession(): GuideSession | null {
  try {
    const visitorId = readVisitorId()
    const raw = window.localStorage.getItem(GUIDE_SESSION_KEY)
    return hydrateGuideSession(raw ? JSON.parse(raw) : null, visitorId)
  } catch {
    return null
  }
}

export function saveGuideSession(session: GuideSession) {
  const next = hydrateGuideSession({ ...session, updatedAt: session.updatedAt || new Date().toISOString() }, session.visitorId)
  if (!next) return
  try {
    rememberVisitorId(next.visitorId)
    window.localStorage.setItem(GUIDE_SESSION_KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
}

export function isFreshIpBinding(at: string, now = Date.now()) {
  const then = Date.parse(at)
  if (!Number.isFinite(then)) return false
  return now - then <= GUIDE_IP_BIND_MS
}

export function guideSessionBlobKey(visitorId: string) {
  const id = sanitizeVisitorId(visitorId)
  return id ? `guide-session-${id}` : ""
}

export function guideIpBlobKey(ipHash: string) {
  const id = sanitizeVisitorId(ipHash)
  return id ? `guide-ip-${id}` : ""
}

export function pickGuideVisitor(options: { clientVisitorId?: string; ipVisitorId?: string; ipAt?: string; now?: number }) {
  const client = sanitizeVisitorId(options.clientVisitorId)
  if (client) return { visitorId: client, via: "device" as const }
  const ipVisitor = sanitizeVisitorId(options.ipVisitorId)
  if (ipVisitor && isFreshIpBinding(options.ipAt || "", options.now)) {
    return { visitorId: ipVisitor, via: "ip" as const }
  }
  return { visitorId: "", via: "none" as const }
}

export function sessionAfterReply(
  messages: unknown,
  reply: string,
  extra: {
    visitorId: string
    advisor: GuideSessionAdvisor
    lang: GuideSessionLang
    handoffIndex?: unknown
    takenOver?: unknown
    now?: string
  },
) {
  const turns = asGuideTurns(messages)
  const text = reply.trim().slice(0, MAX_GUIDE_TURN_CHARS)
  if (text) turns.push({ role: "assistant", content: text })
  return hydrateGuideSession(
    {
      visitorId: extra.visitorId,
      turns,
      advisor: extra.advisor,
      lang: extra.lang,
      handoffIndex: extra.handoffIndex,
      takenOver: extra.takenOver,
      updatedAt: extra.now || new Date().toISOString(),
    },
    extra.visitorId,
  )
}
