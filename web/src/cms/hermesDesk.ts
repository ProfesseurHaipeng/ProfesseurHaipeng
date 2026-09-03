import { completeChatCompletions } from "./chatCompletions"
import { hermesEnvFrom } from "./hermes"
import type { Lead } from "./leads"

export type HermesOwner = "hermes" | "human"
export type HermesEnergy = "high" | "mid" | "low" | "unset"
export type HermesProgress = "new" | "contacted" | "talking" | "sample" | "negotiate" | "hold" | "closed"
export type HermesMailStatus = "none" | "queued" | "sent" | "failed"
export type HermesMailTrack = "none" | "on" | "opened" | "clicked"
export type HermesChannel = "chat" | "email" | "form" | "unset"

export type HermesCase = {
  id: string
  at: string
  updatedAt: string
  name: string
  org: string
  contact: string
  note: string
  place?: string
  leadId?: string
  visitorId?: string
  owner: HermesOwner
  following: boolean
  progress: HermesProgress
  reaction: string
  evaluation: string
  energy: HermesEnergy
  source: "ai" | "form" | "manual"
  gone?: boolean
  mailStatus?: HermesMailStatus
  mailSentAt?: string
  mailFollowUp?: boolean
  mailTracking?: HermesMailTrack
  mailSummary?: string
  inquiryCount?: number
  lastInquiryAt?: string
  lastAdvisorAt?: string
  inquiryPaceMin?: number
  replyPaceMin?: number
  emailReplyHours?: number
  chatTurns?: number
  nextAction?: string
  lastChannel?: HermesChannel
}

export type HermesCoachImage = { id: string; mime: string; name: string }

export type HermesCoachTurn = {
  id: string
  at: string
  role: "staff" | "hermes"
  content: string
  images?: HermesCoachImage[]
}

export type HermesDeskFilter = {
  follow?: "all" | "following" | "idle"
  owner?: "all" | HermesOwner
  energy?: "all" | HermesEnergy
  origin?: "all" | "live"
  query?: string
}

export type HermesMemory = {
  shared: string
  desk: string
  updatedAt: string
}

export type HermesEvent = {
  id: string
  at: string
  caseId?: string
  kind: "ticket" | "escalate" | "takeover" | "resume" | "coach" | "note" | "update" | "attach" | "health"
  text: string
}

export function emptyMemory(): HermesMemory {
  return { shared: "", desk: "", updatedAt: "" }
}

export function newEventId(now = Date.now()) {
  return `evt-${String(now).padStart(15, "0")}-${Math.random().toString(36).slice(2, 8)}`
}

export function isLiveCase(item: HermesCase) {
  return item.source === "ai" || Boolean(item.visitorId)
}

const MAX = {
  name: 120,
  org: 200,
  contact: 200,
  note: 2000,
  reaction: 500,
  evaluation: 500,
  place: 80,
  visitor: 80,
}

export const PROGRESS_LABEL: Record<HermesProgress, string> = {
  new: "刚建档",
  contacted: "已接触",
  talking: "深聊中",
  sample: "样品/方案",
  negotiate: "谈合作",
  hold: "暂缓",
  closed: "已结束",
}

export const ENERGY_LABEL: Record<HermesEnergy, string> = {
  high: "积极性高",
  mid: "一般",
  low: "积极性低",
  unset: "未评估",
}

export const PROGRESS_TRACK: HermesProgress[] = ["new", "contacted", "talking", "sample", "negotiate", "closed"]

export const MAIL_STATUS_LABEL: Record<HermesMailStatus, string> = {
  none: "未发邮件",
  queued: "待发送",
  sent: "已发送",
  failed: "发送失败",
}

export const MAIL_TRACK_LABEL: Record<HermesMailTrack, string> = {
  none: "无跟踪",
  on: "已开跟踪",
  opened: "已打开",
  clicked: "已点击",
}

export const CHANNEL_LABEL: Record<HermesChannel, string> = {
  chat: "对话",
  email: "邮件",
  form: "表单",
  unset: "未知",
}

export const STAFF_ACTIONS = ["health", "coach"] as const

export function isStaffAction(action: string) {
  return action === "health" || action === "coach"
}

export function progressRatio(progress: HermesProgress) {
  if (progress === "hold") return 0.42
  const index = PROGRESS_TRACK.indexOf(progress)
  if (index < 0) return 0
  return index / (PROGRESS_TRACK.length - 1)
}

export function formatPace(minutes?: number) {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return ""
  if (minutes < 1) return "不到 1 分钟"
  if (minutes < 60) return `${Math.round(minutes)} 分钟`
  const hours = minutes / 60
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} 小时`
  return `${Math.round(hours / 24)} 天`
}

export function emptyTelemetry(): Pick<
  HermesCase,
  | "mailStatus"
  | "mailFollowUp"
  | "mailTracking"
  | "mailSummary"
  | "inquiryCount"
  | "chatTurns"
  | "nextAction"
  | "lastChannel"
> {
  return {
    mailStatus: "none",
    mailFollowUp: false,
    mailTracking: "none",
    mailSummary: "",
    inquiryCount: 0,
    chatTurns: 0,
    nextAction: "",
    lastChannel: "unset",
  }
}

export function normalizeCase(item: HermesCase): HermesCase {
  const inquiry = Number(item.inquiryCount)
  const turns = Number(item.chatTurns)
  return {
    ...item,
    mailStatus:
      item.mailStatus === "queued" || item.mailStatus === "sent" || item.mailStatus === "failed" ? item.mailStatus : "none",
    mailFollowUp: item.mailFollowUp === true,
    mailTracking:
      item.mailTracking === "on" || item.mailTracking === "opened" || item.mailTracking === "clicked"
        ? item.mailTracking
        : "none",
    mailSummary: typeof item.mailSummary === "string" ? item.mailSummary : "",
    inquiryCount: Number.isFinite(inquiry) && inquiry > 0 ? inquiry : 0,
    chatTurns: Number.isFinite(turns) && turns > 0 ? turns : 0,
    nextAction: typeof item.nextAction === "string" ? item.nextAction : "",
    lastChannel:
      item.lastChannel === "chat" || item.lastChannel === "email" || item.lastChannel === "form" ? item.lastChannel : "unset",
  }
}

function minutesBetween(from?: string, to = "") {
  if (!from) return undefined
  const gap = (Date.parse(to) - Date.parse(from)) / 60000
  return Number.isFinite(gap) && gap >= 0 ? Math.round(gap) : undefined
}

export function recordInquiry(item: HermesCase, now = new Date().toISOString()): HermesCase {
  const current = normalizeCase(item)
  const inquiryPace = minutesBetween(current.lastInquiryAt, now) ?? current.inquiryPaceMin
  const replyPace = minutesBetween(current.lastAdvisorAt, now) ?? current.replyPaceMin
  return {
    ...current,
    inquiryCount: (current.inquiryCount || 0) + 1,
    chatTurns: (current.chatTurns || 0) + 1,
    lastInquiryAt: now,
    lastAdvisorAt: now,
    inquiryPaceMin: inquiryPace,
    replyPaceMin: replyPace,
    lastChannel: "chat",
    updatedAt: now,
  }
}

export function formatInquiryRate(item: HermesCase, now = Date.now()) {
  const count = item.inquiryCount || 0
  if (count < 1 || !item.at) return ""
  const days = (now - Date.parse(item.at)) / 86400000
  if (!Number.isFinite(days) || days < 0) return ""
  if (days < 1) return `${count} 次 / 当天`
  return `${Math.round((count / days) * 7 * 10) / 10} 次 / 周`
}

export function boardMetrics(cases: HermesCase[]) {
  const live = cases.filter((item) => isLiveCase(item)).map(normalizeCase)
  const withPace = live.filter((item) => item.inquiryPaceMin != null)
  const withReply = live.filter((item) => item.replyPaceMin != null)
  const withMailReply = live.filter((item) => item.emailReplyHours != null)
  return {
    live: live.length,
    following: live.filter((item) => item.following && item.owner === "hermes").length,
    idle: live.filter((item) => !item.following && item.owner === "hermes").length,
    human: live.filter((item) => item.owner === "human").length,
    high: live.filter((item) => item.energy === "high").length,
    low: live.filter((item) => item.energy === "low").length,
    archived: cases.filter((item) => !isLiveCase(item)).length,
    mailNone: live.filter((item) => item.mailStatus === "none").length,
    mailQueued: live.filter((item) => item.mailStatus === "queued").length,
    mailSent: live.filter((item) => item.mailStatus === "sent").length,
    mailFailed: live.filter((item) => item.mailStatus === "failed").length,
    mailFollow: live.filter((item) => item.mailFollowUp).length,
    mailTracked: live.filter((item) => item.mailTracking !== "none").length,
    mailSummarized: live.filter((item) => Boolean(item.mailSummary)).length,
    inquiries: live.reduce((sum, item) => sum + (item.inquiryCount || 0), 0),
    chatTurns: live.reduce((sum, item) => sum + (item.chatTurns || 0), 0),
    avgInquiryPace: withPace.length
      ? Math.round(withPace.reduce((sum, item) => sum + (item.inquiryPaceMin || 0), 0) / withPace.length)
      : undefined,
    avgReplyPace: withReply.length
      ? Math.round(withReply.reduce((sum, item) => sum + (item.replyPaceMin || 0), 0) / withReply.length)
      : undefined,
    avgMailReply: withMailReply.length
      ? Math.round((withMailReply.reduce((sum, item) => sum + (item.emailReplyHours || 0), 0) / withMailReply.length) * 10) / 10
      : undefined,
    worldProgress: live.length
      ? live.reduce((sum, item) => sum + progressRatio(item.progress), 0) / live.length
      : 0,
  }
}

export function newImageId(now = Date.now()) {
  return `img-${String(now).padStart(15, "0")}-${Math.random().toString(36).slice(2, 8)}`
}

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

export function sanitizeCoachImages(raw: unknown) {
  if (!Array.isArray(raw)) return []
  const out: { id: string; mime: string; name: string; data: string }[] = []
  for (const item of raw.slice(0, 3)) {
    if (!item || typeof item !== "object") continue
    const row = item as { mime?: unknown; name?: unknown; data?: unknown }
    const mime = typeof row.mime === "string" ? row.mime : ""
    const data = typeof row.data === "string" ? row.data.replace(/\s+/g, "") : ""
    const name = typeof row.name === "string" ? row.name.replace(/\s+/g, " ").trim().slice(0, 80) : "image"
    if (!IMAGE_MIME.has(mime) || !/^[A-Za-z0-9+/=]+$/.test(data)) continue
    if (data.length * 0.75 > 1_600_000) continue
    out.push({ id: newImageId(), mime, name, data })
  }
  return out
}

export function newHermesCaseId(now = Date.now()) {
  return `case-${String(now).padStart(15, "0")}-${Math.random().toString(36).slice(2, 8)}`
}

export function newCoachTurnId(now = Date.now()) {
  return `coach-${String(now).padStart(15, "0")}-${Math.random().toString(36).slice(2, 8)}`
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

function asProgress(value: unknown): HermesProgress {
  return typeof value === "string" && value in PROGRESS_LABEL ? (value as HermesProgress) : "new"
}

function asEnergy(value: unknown): HermesEnergy {
  return value === "high" || value === "low" || value === "mid" || value === "unset" ? value : "unset"
}

function asOwner(value: unknown): HermesOwner {
  return value === "human" ? "human" : "hermes"
}

export function sortHermesCases(cases: HermesCase[]) {
  return [...cases].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
}

export function filterHermesCases(cases: HermesCase[], filter: HermesDeskFilter = {}) {
  const query = (filter.query || "").trim().toLowerCase()
  return sortHermesCases(cases).filter((item) => {
    if (filter.origin === "live" && !isLiveCase(item)) return false
    if (filter.follow === "following" && !item.following) return false
    if (filter.follow === "idle" && item.following) return false
    if (filter.owner && filter.owner !== "all" && item.owner !== filter.owner) return false
    if (filter.energy && filter.energy !== "all" && item.energy !== filter.energy) return false
    if (!query) return true
    const hay = `${item.name} ${item.org} ${item.note} ${item.reaction} ${item.evaluation}`.toLowerCase()
    return hay.includes(query)
  })
}

export function deskStats(cases: HermesCase[]) {
  const live = cases.filter((item) => isLiveCase(item))
  return {
    total: live.length,
    following: live.filter((item) => item.following && item.owner === "hermes").length,
    idle: live.filter((item) => !item.following && item.owner === "hermes").length,
    human: live.filter((item) => item.owner === "human").length,
    high: live.filter((item) => item.energy === "high").length,
    low: live.filter((item) => item.energy === "low").length,
    live: live.length,
    archived: cases.filter((item) => !isLiveCase(item)).length,
  }
}

export function pipelineStats(cases: HermesCase[]) {
  const live = cases.filter((item) => isLiveCase(item))
  return (Object.keys(PROGRESS_LABEL) as HermesProgress[]).reduce(
    (acc, key) => {
      acc[key] = live.filter((item) => item.progress === key).length
      return acc
    },
    {} as Record<HermesProgress, number>,
  )
}

export function attachableLeads(cases: HermesCase[], leads: Lead[]) {
  return leads.filter((lead) => {
    if (lead.source !== "ai") return false
    return !findHermesCase(cases, { leadId: lead.id, contact: lead.contact || lead.email })
  })
}

export function publicAttachable(leads: Lead[]) {
  return leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    org: lead.org,
    note: lead.note,
    at: lead.at,
  }))
}

export function attachLead(cases: HermesCase[], leads: Lead[], leadId: string, now = new Date().toISOString()) {
  const lead = leads.find((item) => item.id === leadId)
  if (!lead) return { cases, case: null as HermesCase | null, error: "missing" as const }
  if (lead.source !== "ai") return { cases, case: null, error: "not-ai" as const }
  const hit = findHermesCase(cases, { leadId: lead.id, contact: lead.contact || lead.email })
  if (hit) return { cases, case: hit, error: "exists" as const }
  const created = caseFromLead(lead, now)
  return { cases: sortHermesCases([created, ...cases]), case: created, error: null }
}

/** Frontend Hermes only. Never include desk memory, evaluations, or other customers. */
export function frontHermesExtra(memory: HermesMemory | undefined, item: HermesCase | null, extra?: string) {
  return [
    extra?.trim() || "",
    memory?.shared?.trim() ? `【长期记忆（与后台共用）】\n${memory.shared.trim()}` : "",
    publicVisitorContext(item),
  ]
    .filter(Boolean)
    .join("\n\n")
}

export type HermesDeskLink = { configured: boolean; model: string; host: string }
export type HermesAttachable = { id: string; name: string; org: string; note: string; at: string }

export function decorateDeskPayload(options: {
  cases: HermesCase[]
  coach: HermesCoachTurn[]
  events: HermesEvent[]
  memory: HermesMemory
  health: { status: "connected" | "disconnected"; checkedAt: string; model?: string; detail?: string } | null
  link: HermesDeskLink
  hermesReady: boolean
  attachable: HermesAttachable[]
  filter?: HermesDeskFilter
}) {
  return {
    cases: filterHermesCases(options.cases, options.filter).map(normalizeCase),
    coach: options.coach,
    events: options.events,
    memory: options.memory,
    link: options.link,
    health: options.health,
    hermesReady: options.hermesReady,
    attachable: options.attachable,
    stats: deskStats(options.cases),
    attention: attentionCases(options.cases),
    pipeline: pipelineStats(options.cases),
    board: boardMetrics(options.cases),
  }
}

export function attentionCases(cases: HermesCase[]) {
  const live = cases.filter((item) => isLiveCase(item))
  return {
    human: live.filter((item) => item.owner === "human"),
    high: live.filter((item) => item.energy === "high" && item.owner === "hermes"),
    stale: live.filter((item) => item.following && item.owner === "hermes" && !item.reaction && !item.evaluation),
  }
}

export function publicVisitorContext(item: HermesCase | null) {
  if (!item) return ""
  return [
    "【本场客户已知事实，可在前台使用】",
    item.name ? `称呼：${item.name}` : "",
    item.org ? `机构：${item.org}` : "",
    item.note ? `线索：${item.note}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function findHermesCase(
  cases: HermesCase[],
  keys: { id?: string; visitorId?: string; contact?: string; leadId?: string },
) {
  if (keys.id) {
    const hit = cases.find((item) => item.id === keys.id)
    if (hit) return hit
  }
  if (keys.visitorId) {
    const hit = cases.find((item) => item.visitorId && item.visitorId === keys.visitorId)
    if (hit) return hit
  }
  const contact = (keys.contact || "").trim()
  if (contact.length >= 5) {
    const hit = cases.find((item) => item.contact && item.contact === contact)
    if (hit) return hit
  }
  if (keys.leadId) {
    const hit = cases.find((item) => item.leadId && item.leadId === keys.leadId)
    if (hit) return hit
  }
  return null
}

export function isHumanOwned(cases: HermesCase[], visitorId?: string, contact?: string) {
  const hit = findHermesCase(cases, { visitorId, contact })
  return hit?.owner === "human"
}

export function humanTakenOverReply(lang: "zh" | "en") {
  return lang === "en"
    ? "A team member has taken this conversation. Hermes will step back. Leave your crop and tonnage here, and someone from the project will follow up."
    : "这条线索已由项目人员人工接管，高级顾问先不介入。您可以继续留言，工作人员会按这条线索跟进。"
}

export function applyTakeover(item: HermesCase, now = new Date().toISOString()): HermesCase {
  return { ...item, owner: "human", following: false, updatedAt: now }
}

export function applyResume(item: HermesCase, now = new Date().toISOString()): HermesCase {
  return { ...item, owner: "hermes", following: true, updatedAt: now }
}

export function patchHermesCase(item: HermesCase, raw: Record<string, unknown>, now = new Date().toISOString()): HermesCase {
  const next: HermesCase = { ...item, updatedAt: now }
  if ("name" in raw) next.name = clean(raw.name, MAX.name) || item.name
  if ("org" in raw) next.org = clean(raw.org, MAX.org)
  if ("contact" in raw) next.contact = clean(raw.contact, MAX.contact)
  if ("note" in raw) next.note = clean(raw.note, MAX.note)
  if ("place" in raw) next.place = clean(raw.place, MAX.place) || undefined
  if ("visitorId" in raw) next.visitorId = clean(raw.visitorId, MAX.visitor) || undefined
  if ("leadId" in raw) next.leadId = clean(raw.leadId, 80) || undefined
  if ("owner" in raw) next.owner = asOwner(raw.owner)
  if ("following" in raw) next.following = raw.following === true
  if ("progress" in raw) next.progress = asProgress(raw.progress)
  if ("reaction" in raw) next.reaction = clean(raw.reaction, MAX.reaction)
  if ("evaluation" in raw) next.evaluation = clean(raw.evaluation, MAX.evaluation)
  if ("energy" in raw) next.energy = asEnergy(raw.energy)
  if ("mailStatus" in raw) {
    next.mailStatus =
      raw.mailStatus === "queued" || raw.mailStatus === "sent" || raw.mailStatus === "failed" || raw.mailStatus === "none"
        ? raw.mailStatus
        : next.mailStatus
  }
  if ("mailSentAt" in raw) next.mailSentAt = clean(raw.mailSentAt, 40) || undefined
  if ("lastAdvisorAt" in raw) next.lastAdvisorAt = clean(raw.lastAdvisorAt, 40) || undefined
  if ("mailFollowUp" in raw) next.mailFollowUp = raw.mailFollowUp === true
  if ("mailTracking" in raw) {
    next.mailTracking =
      raw.mailTracking === "on" || raw.mailTracking === "opened" || raw.mailTracking === "clicked" || raw.mailTracking === "none"
        ? raw.mailTracking
        : next.mailTracking
  }
  if ("mailSummary" in raw) next.mailSummary = clean(raw.mailSummary, 800)
  if ("inquiryCount" in raw && typeof raw.inquiryCount === "number" && raw.inquiryCount >= 0) {
    next.inquiryCount = Math.min(9999, Math.round(raw.inquiryCount))
  }
  if ("inquiryPaceMin" in raw && typeof raw.inquiryPaceMin === "number" && raw.inquiryPaceMin >= 0) {
    next.inquiryPaceMin = Math.round(raw.inquiryPaceMin)
  }
  if ("replyPaceMin" in raw && typeof raw.replyPaceMin === "number" && raw.replyPaceMin >= 0) {
    next.replyPaceMin = Math.round(raw.replyPaceMin)
  }
  if ("emailReplyHours" in raw && typeof raw.emailReplyHours === "number" && raw.emailReplyHours >= 0) {
    next.emailReplyHours = Math.round(raw.emailReplyHours * 10) / 10
  }
  if ("chatTurns" in raw && typeof raw.chatTurns === "number" && raw.chatTurns >= 0) {
    next.chatTurns = Math.min(9999, Math.round(raw.chatTurns))
  }
  if ("nextAction" in raw) next.nextAction = clean(raw.nextAction, 200)
  if ("lastChannel" in raw) {
    next.lastChannel =
      raw.lastChannel === "chat" || raw.lastChannel === "email" || raw.lastChannel === "form" ? raw.lastChannel : next.lastChannel
  }
  if (next.owner === "human") next.following = false
  return next
}

export function caseFromLead(lead: Lead, now = new Date().toISOString()): HermesCase {
  const contact = lead.contact || lead.email || ""
  return {
    id: newHermesCaseId(),
    at: lead.at || now,
    updatedAt: now,
    name: lead.name || "未留称呼",
    org: lead.org || "",
    contact,
    note: lead.note || "",
    place: lead.place,
    leadId: lead.id,
    owner: "hermes",
    following: lead.source === "ai",
    progress: lead.source === "ai" ? "contacted" : "new",
    reaction: "",
    evaluation: "",
    energy: "unset",
    source: lead.source === "ai" ? "ai" : "form",
    ...emptyTelemetry(),
    lastChannel: lead.source === "ai" ? "chat" : "form",
  }
}

export function upsertFromTicket(
  cases: HermesCase[],
  ticket: { name: string; org: string; contact: string; note: string },
  extra: { visitorId?: string; place?: string; leadId?: string; following?: boolean },
  now = new Date().toISOString(),
) {
  const existing = findHermesCase(cases, {
    visitorId: extra.visitorId,
    contact: ticket.contact,
    leadId: extra.leadId,
  })
  const next = existing
    ? patchHermesCase(
        existing,
        {
          name: ticket.name || existing.name,
          org: ticket.org || existing.org,
          contact: ticket.contact || existing.contact,
          note: ticket.note || existing.note,
          place: extra.place || existing.place,
          visitorId: extra.visitorId || existing.visitorId,
          leadId: extra.leadId || existing.leadId,
          following: extra.following ?? existing.following,
          progress: existing.progress === "new" ? "contacted" : existing.progress,
        },
        now,
      )
    : {
        id: newHermesCaseId(),
        at: now,
        updatedAt: now,
        name: ticket.name || "AI 对话客户",
        org: ticket.org,
        contact: ticket.contact,
        note: ticket.note,
        place: extra.place,
        leadId: extra.leadId,
        visitorId: extra.visitorId,
        owner: "hermes" as const,
        following: extra.following ?? true,
        progress: "contacted" as const,
        reaction: "",
        evaluation: "",
        energy: "unset" as const,
        source: "ai" as const,
        ...emptyTelemetry(),
        lastChannel: "chat" as const,
        inquiryCount: 1,
        chatTurns: 1,
        lastInquiryAt: now,
        lastAdvisorAt: now,
      }
  if (next.owner === "human") next.following = false
  return { cases: [next, ...cases.filter((item) => item.id !== next.id)], case: next }
}

export function upsertFromVisit(
  cases: HermesCase[],
  visitorId: string,
  note: string,
  now = new Date().toISOString(),
) {
  const existing = findHermesCase(cases, { visitorId })
  if (existing) {
    if (existing.owner === "human") return { cases, case: existing }
    const touched = recordInquiry(existing, now)
    const next = patchHermesCase(
      touched,
      { following: true, progress: existing.progress === "new" ? "talking" : existing.progress, note: note || existing.note },
      now,
    )
    return { cases: [next, ...cases.filter((item) => item.id !== next.id)], case: next }
  }
  const created: HermesCase = {
    id: newHermesCaseId(),
    at: now,
    updatedAt: now,
    name: "对话客户",
    org: "",
    contact: "",
    note: note.slice(0, MAX.note),
    visitorId,
    owner: "hermes",
    following: true,
    progress: "talking",
    reaction: "",
    evaluation: "",
    energy: "unset",
    source: "ai",
    ...emptyTelemetry(),
    lastChannel: "chat",
    inquiryCount: 1,
    chatTurns: 1,
    lastInquiryAt: now,
    lastAdvisorAt: now,
  }
  return { cases: [created, ...cases], case: created }
}

export function importLeads(cases: HermesCase[], leads: Lead[], now = new Date().toISOString()) {
  let next = cases
  for (const lead of leads) {
    if (lead.source !== "ai") continue
    const hit = findHermesCase(next, { leadId: lead.id, contact: lead.contact || lead.email })
    if (hit) continue
    next = [caseFromLead(lead, now), ...next]
  }
  return sortHermesCases(next)
}

export function pruneUnspokenCases(cases: HermesCase[]) {
  return cases.filter((item) => isLiveCase(item) || item.reaction || item.evaluation)
}

const DESK_RE = /<desk>([\s\S]*?)<\/desk>/i

export function stripDeskTags(text: string) {
  return text.replace(DESK_RE, "").replace(/<\/?desk>/gi, "").trim()
}

function memoryPatchFrom(raw: Record<string, unknown>): Partial<HermesMemory> | undefined {
  const nested = raw.memory && typeof raw.memory === "object" ? (raw.memory as Record<string, unknown>) : undefined
  const shared = typeof nested?.shared === "string" ? nested.shared : typeof raw.shared === "string" ? raw.shared : undefined
  const desk = typeof nested?.desk === "string" ? nested.desk : typeof raw.desk === "string" ? raw.desk : undefined
  if (shared == null && desk == null) return undefined
  return { ...(shared != null ? { shared } : {}), ...(desk != null ? { desk } : {}) }
}

export function applyMemoryPatch(current: HermesMemory, patch: Partial<HermesMemory>, now = new Date().toISOString()): HermesMemory {
  return {
    shared: typeof patch.shared === "string" ? patch.shared.trim().slice(0, 8000) : current.shared,
    desk: typeof patch.desk === "string" ? patch.desk.trim().slice(0, 8000) : current.desk,
    updatedAt: now,
  }
}

export function extractDeskUpdates(reply: string): {
  reply: string
  updates: Record<string, unknown>[]
  memory?: Partial<HermesMemory>
} {
  const match = reply.match(DESK_RE)
  const cleaned = stripDeskTags(reply)
  if (!match) return { reply: cleaned, updates: [] }
  try {
    const raw = JSON.parse(match[1]) as Record<string, unknown>
    const memory = memoryPatchFrom(raw)
    if (Array.isArray(raw.updates)) {
      return {
        reply: cleaned,
        updates: raw.updates.filter((item) => item && typeof item === "object") as Record<string, unknown>[],
        memory,
      }
    }
    if (
      raw.id ||
      raw.progress ||
      raw.energy ||
      raw.reaction ||
      raw.evaluation ||
      raw.mailStatus ||
      raw.mailSummary ||
      raw.mailTracking ||
      raw.nextAction ||
      "mailFollowUp" in raw ||
      "following" in raw ||
      "owner" in raw ||
      "inquiryCount" in raw
    ) {
      return { reply: cleaned, updates: [raw], memory }
    }
    if (memory) return { reply: cleaned, updates: [], memory }
  } catch {
    /* ignore bad desk payload */
  }
  return { reply: cleaned, updates: [] }
}

export function applyDeskUpdates(cases: HermesCase[], updates: Record<string, unknown>[], now = new Date().toISOString()) {
  let next = cases
  for (const raw of updates) {
    const id = typeof raw.id === "string" ? raw.id : ""
    const hit = findHermesCase(next, { id, contact: typeof raw.contact === "string" ? raw.contact : undefined })
    if (!hit) continue
    const patched = patchHermesCase(hit, raw, now)
    next = [patched, ...next.filter((item) => item.id !== patched.id)]
  }
  return sortHermesCases(next)
}

const COACH_RULES = `你是皮纳图博火山灰项目的高级顾问 Hermes。后台工作台和前台高级顾问是同一个人、同一份长期记忆，只是这里权限更高。

【后台权限】
- 能看全部真实客户档案、同事指令、desk 记忆、接管状态。
- 前台对话看不到这些。你在前台也不会、不能把工作台数据说出去。
- 不要编造客户。档案列表没有的人，就说还没有这场对话。

【控制权】
- 同事只能通过这个对话框给你下指令。进度、接管、邮件状态、跟单、跟踪、行为数据、记忆，全部由你改，不要让同事在界面上改。
- 同事说接管 / 交回 / 改进度 / 记邮件 / 改记忆，你用 <desk> 更新。一键接管也只能由你执行。

【你能做的】
- 根据同事的意图，说明你会怎么跟进哪些客户、话术怎么改、谁先谁后。
- 用短段纯文本，不要 Markdown。
- 向同事汇报时默认隐藏邮箱和其他隐私联系方式，只写称呼、机构、作物、区域、吨位和跟进事项。
- 需要改档案或记忆时，先用正常的话说明改了什么，再在回复最后另起一行输出：
  <desk>{"memory":{"shared":"与前台共用的长期记忆","desk":"仅后台笔记"},"updates":[{"id":"客户档案id","following":true,"owner":"hermes","progress":"talking","energy":"high","mailStatus":"sent","mailFollowUp":true,"mailTracking":"on","mailSummary":"客户回邮大意","inquiryCount":2,"replyPaceMin":15,"emailReplyHours":6,"nextAction":"寄样品","lastChannel":"email"}]}</desk>
- progress 只能是 new / contacted / talking / sample / negotiate / hold / closed。
- energy 只能是 high / mid / low / unset。
- mailStatus 只能是 none / queued / sent / failed。
- mailTracking 只能是 none / on / opened / clicked。
- 没有真实邮件或对话记录时，不要编发送成功、跟单、速度和摘要。
- 不要提 NAS、端口、网关、沙箱。`

export function caseBrief(item: HermesCase) {
  const contact = item.contact ? "已留联系方式" : "未留联系方式"
  return [
    `id=${item.id}`,
    `称呼=${item.name}`,
    item.org ? `机构=${item.org}` : "",
    `跟进方=${item.owner === "human" ? "人工" : "Hermes"}`,
    `状态=${item.following ? "正在跟进" : "未跟进"}`,
    `进度=${PROGRESS_LABEL[item.progress]}`,
    item.energy !== "unset" ? `积极性=${ENERGY_LABEL[item.energy]}` : "积极性=未评估",
    contact,
    item.note ? `线索=${item.note}` : "",
    item.reaction ? `反响=${item.reaction}` : "",
    item.evaluation ? `评价=${item.evaluation}` : "",
    `邮件=${MAIL_STATUS_LABEL[item.mailStatus || "none"]}${item.mailFollowUp ? "，有跟单" : ""}${item.mailTracking && item.mailTracking !== "none" ? `，${MAIL_TRACK_LABEL[item.mailTracking]}` : ""}`,
    item.mailSummary ? `回邮摘要=${item.mailSummary}` : "",
    item.inquiryCount ? `询单=${item.inquiryCount}次` : "",
    formatInquiryRate(item) ? `询单速度=${formatInquiryRate(item)}` : "",
    item.inquiryPaceMin != null ? `询单间隔=${formatPace(item.inquiryPaceMin)}` : "",
    item.replyPaceMin != null ? `回复速度=${formatPace(item.replyPaceMin)}` : "",
    item.emailReplyHours != null ? `回邮用时=${item.emailReplyHours}小时` : "",
    item.nextAction ? `下一步=${item.nextAction}` : "",
  ]
    .filter(Boolean)
    .join("；")
}

export function buildCoachMessages(
  cases: HermesCase[],
  history: HermesCoachTurn[],
  extra?: string,
  memory?: HermesMemory,
) {
  const live = cases.filter((item) => isLiveCase(item)).map(normalizeCase)
  const roster = live.length
    ? live.slice(0, 40).map((item) => `- ${caseBrief(item)}`).join("\n")
    : "当前还没有真实客户档案。不要编造。"
  const memoryBlock = [
    memory?.shared?.trim() ? `【长期记忆（与前台共用）】\n${memory.shared.trim()}` : "",
    memory?.desk?.trim() ? `【工作台笔记（仅后台）】\n${memory.desk.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
  const system = `${COACH_RULES}\n\n【当前客户档案】\n${roster}${memoryBlock ? `\n\n${memoryBlock}` : ""}${extra ? `\n\n${extra}` : ""}`
  const turns = history.slice(-16).map((item) => ({
    role: item.role === "staff" ? ("user" as const) : ("assistant" as const),
    content: item.images?.length
      ? `${item.content.slice(0, 4000)}\n\n[同事附了 ${item.images.length} 张图]`
      : item.content.slice(0, 4000),
  }))
  return [{ role: "system" as const, content: system }, ...turns]
}

export function coachUnavailableReply() {
  return "指令已记下。顾问网关还没接到站点上，接通后我会按这条调整跟进和话术。"
}

export async function resolveCoachReply(
  cases: HermesCase[],
  history: HermesCoachTurn[],
  env: Record<string, string | undefined>,
  memory?: HermesMemory,
  images?: { mime: string; data: string }[],
) {
  const hermes = hermesEnvFrom(env)
  if (!hermes) {
    return { reply: coachUnavailableReply(), cases, memory, source: "local" as const }
  }
  try {
    const raw = await completeChatCompletions(hermes, buildCoachMessages(cases, history, undefined, memory), {
      hosts: "exact",
      images,
    })
    if (raw) {
      const parsed = extractDeskUpdates(raw)
      if (parsed.reply) {
        return {
          reply: parsed.reply,
          cases: applyDeskUpdates(cases, parsed.updates),
          memory: parsed.memory && memory ? applyMemoryPatch(memory, parsed.memory) : memory,
          source: "hermes" as const,
        }
      }
    }
  } catch (error) {
    console.error("ash-hermes-desk coach", error)
  }
  return { reply: coachUnavailableReply(), cases, memory, source: "local" as const }
}
