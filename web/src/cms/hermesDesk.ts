import { completeChatCompletions } from "./chatCompletions"
import { hermesEnvFrom } from "./hermes"
import {
  applyInquiryState,
  attachTaskCase,
  buildTaskAssignMessage,
  cancelInquiryTask,
  createInquiryTask,
  deleteInquiryTask,
  emptyInquiry,
  extractInquiryUpdates,
  hydrateInquiryState,
  inquiryCoachExtra,
  startInquiryTask,
  stripInquiryTags,
  updateInquiryTask,
  type InquiryState,
  type InquiryTask,
} from "./inquiryDesk"
import type { Lead } from "./leads"

export type HermesOwner = "hermes" | "human"
export type HermesEnergy = "high" | "mid" | "low" | "unset"
export type HermesProgress = "new" | "contacted" | "talking" | "sample" | "negotiate" | "hold" | "closed"
export type HermesMailStatus = "none" | "queued" | "sent" | "failed"
export type HermesMailTrack = "none" | "on" | "opened" | "clicked"
export type HermesChannel = "chat" | "email" | "form" | "unset"
export type CaseColor = "none" | "red" | "orange" | "yellow" | "green" | "blue" | "purple"
export type CaseCategory = "unset" | "lead" | "inquiry" | "partner" | "sample" | "test" | "other"

export type HermesCase = {
  id: string
  at: string
  updatedAt: string
  name: string
  org: string
  factory?: string
  ticketNo?: string
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
  color?: CaseColor
  category?: CaseCategory
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
  color?: "all" | CaseColor
  category?: "all" | CaseCategory
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
  if (item.gone) return false
  return (
    item.source === "ai" ||
    item.source === "form" ||
    item.source === "manual" ||
    Boolean(item.visitorId) ||
    Boolean(item.leadId)
  )
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

export const CASE_COLORS: { key: CaseColor; label: string; swatch: string }[] = [
  { key: "none", label: "无色", swatch: "#d2d2d7" },
  { key: "red", label: "红", swatch: "#ff3b30" },
  { key: "orange", label: "橙", swatch: "#ff9500" },
  { key: "yellow", label: "黄", swatch: "#ffcc00" },
  { key: "green", label: "绿", swatch: "#34c759" },
  { key: "blue", label: "蓝", swatch: "#007aff" },
  { key: "purple", label: "紫", swatch: "#af52de" },
]

export const CASE_CATEGORIES: { key: CaseCategory; label: string }[] = [
  { key: "unset", label: "未分类" },
  { key: "lead", label: "线索" },
  { key: "inquiry", label: "询单" },
  { key: "partner", label: "合作" },
  { key: "sample", label: "样品" },
  { key: "test", label: "测试" },
  { key: "other", label: "其他" },
]

export const CASE_COLOR_LABEL: Record<CaseColor, string> = Object.fromEntries(
  CASE_COLORS.map((item) => [item.key, item.label]),
) as Record<CaseColor, string>

export const CASE_CATEGORY_LABEL: Record<CaseCategory, string> = Object.fromEntries(
  CASE_CATEGORIES.map((item) => [item.key, item.label]),
) as Record<CaseCategory, string>

export type HermesLedger = {
  goneIds: string[]
  goneLeadIds: string[]
  goneVisitorIds: string[]
  goneContacts: string[]
  updatedAt: string
}

export function emptyLedger(): HermesLedger {
  return { goneIds: [], goneLeadIds: [], goneVisitorIds: [], goneContacts: [], updatedAt: "" }
}

function uniqueIds(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

export function hydrateLedger(raw: unknown): HermesLedger {
  const base = emptyLedger()
  if (!raw || typeof raw !== "object") return base
  const row = raw as Record<string, unknown>
  const list = (value: unknown) =>
    Array.isArray(value) ? uniqueIds(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))) : []
  return {
    goneIds: list(row.goneIds),
    goneLeadIds: list(row.goneLeadIds),
    goneVisitorIds: list(row.goneVisitorIds),
    goneContacts: list(row.goneContacts),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  }
}

export function markGoneOnLedger(ledger: HermesLedger, item: HermesCase, now = new Date().toISOString()): HermesLedger {
  return {
    goneIds: uniqueIds([...ledger.goneIds, item.id]),
    goneLeadIds: item.leadId ? uniqueIds([...ledger.goneLeadIds, item.leadId]) : ledger.goneLeadIds,
    goneVisitorIds: item.visitorId ? uniqueIds([...ledger.goneVisitorIds, item.visitorId]) : ledger.goneVisitorIds,
    goneContacts: item.contact && item.contact.trim().length >= 5 ? uniqueIds([...ledger.goneContacts, item.contact.trim()]) : ledger.goneContacts,
    updatedAt: now,
  }
}

export function reviveOnLedger(ledger: HermesLedger, item: Pick<HermesCase, "id" | "leadId" | "visitorId" | "contact">, now = new Date().toISOString()): HermesLedger {
  const contact = (item.contact || "").trim()
  return {
    goneIds: ledger.goneIds.filter((id) => id !== item.id),
    goneLeadIds: item.leadId ? ledger.goneLeadIds.filter((id) => id !== item.leadId) : ledger.goneLeadIds,
    goneVisitorIds: item.visitorId ? ledger.goneVisitorIds.filter((id) => id !== item.visitorId) : ledger.goneVisitorIds,
    goneContacts: contact.length >= 5 ? ledger.goneContacts.filter((row) => row !== contact) : ledger.goneContacts,
    updatedAt: now,
  }
}

export function isVisitorSuppressed(visitorId: string, ledger: HermesLedger) {
  return Boolean(visitorId) && ledger.goneVisitorIds.includes(visitorId)
}

export function isIdentitySuppressed(
  keys: { id?: string; visitorId?: string; contact?: string; leadId?: string },
  ledger: HermesLedger,
) {
  if (keys.id && ledger.goneIds.includes(keys.id)) return true
  if (keys.visitorId && isVisitorSuppressed(keys.visitorId, ledger)) return true
  if (keys.leadId && ledger.goneLeadIds.includes(keys.leadId)) return true
  const contact = (keys.contact || "").trim()
  return contact.length >= 5 && ledger.goneContacts.includes(contact)
}

export function isCaseSuppressed(item: HermesCase, ledger: HermesLedger) {
  return Boolean(item.gone) || isIdentitySuppressed(item, ledger)
}

export function isLeadSuppressed(lead: Lead, ledger: HermesLedger) {
  return isIdentitySuppressed({ leadId: lead.id, contact: lead.contact || lead.email }, ledger)
}

/** Refuse live writes that would undelete a tombstone or recreate a suppressed identity. */
export function canWriteLiveHermesCase(item: HermesCase, existing: HermesCase | null | undefined, ledger: HermesLedger) {
  if (item.gone) return true
  if (existing?.gone) return false
  return !isIdentitySuppressed(
    { id: item.id, visitorId: item.visitorId, contact: item.contact, leadId: item.leadId },
    ledger,
  )
}

export function liveCases(cases: HermesCase[], ledger: HermesLedger = emptyLedger()) {
  return sortHermesCases(dedupeHermesCases(cases.filter((item) => !isCaseSuppressed(item, ledger))))
}

export function dedupeHermesCases(cases: HermesCase[]) {
  const seen = new Set<string>()
  const next: HermesCase[] = []
  for (const item of sortHermesCases(cases)) {
    const keys = [
      item.id,
      item.ticketNo ? `ticket:${item.ticketNo}` : "",
      item.leadId ? `lead:${item.leadId}` : "",
      item.visitorId ? `visitor:${item.visitorId}` : "",
    ].filter(Boolean)
    if (keys.some((key) => seen.has(key))) continue
    for (const key of keys) seen.add(key)
    next.push(item)
  }
  return next
}

export const STAFF_ACTIONS = ["health", "coach", "targets", "job", "file", "attach", "import", "cases", "coach-clear", "task"] as const

export const STAFF_CASE_FIELDS = [
  "name",
  "org",
  "factory",
  "contact",
  "note",
  "place",
  "progress",
  "owner",
  "following",
  "energy",
  "nextAction",
  "color",
  "category",
] as const

export type StaffCasePatch = Partial<Pick<HermesCase, (typeof STAFF_CASE_FIELDS)[number]>>

export function isStaffAction(action: string) {
  return (
    action === "health" ||
    action === "coach" ||
    action === "targets" ||
    action === "job" ||
    action === "file" ||
    action === "attach" ||
    action === "import" ||
    action === "cases" ||
    action === "coach-clear" ||
    action === "task"
  )
}

function staffCasePatch(raw: Record<string, unknown>): StaffCasePatch {
  const patch: StaffCasePatch = {}
  for (const key of STAFF_CASE_FIELDS) {
    if (key in raw) (patch as Record<string, unknown>)[key] = raw[key]
  }
  return patch
}

export function applyStaffCaseUpdate(cases: HermesCase[], id: string, raw: Record<string, unknown>, now = new Date().toISOString()) {
  const patch = staffCasePatch(raw)
  if (!id || !Object.keys(patch).length) return { cases, error: "empty" as const }
  const hit = cases.find((item) => item.id === id && !item.gone)
  if (!hit) return { cases, error: "missing" as const }
  const next = patchHermesCase(hit, patch, now)
  return { cases: sortHermesCases([next, ...cases.filter((item) => item.id !== id)]), case: next, error: null }
}

export function applyStaffCasesBatch(
  cases: HermesCase[],
  ids: string[],
  raw: Record<string, unknown>,
  now = new Date().toISOString(),
) {
  const patch = staffCasePatch(raw)
  const wanted = new Set(ids.filter((item) => item.startsWith("case-")))
  if (!wanted.size || !Object.keys(patch).length) return { cases, count: 0, error: "empty" as const }
  let count = 0
  const next = cases.map((item) => {
    if (!wanted.has(item.id) || item.gone) return item
    count += 1
    return patchHermesCase(item, patch, now)
  })
  return { cases: sortHermesCases(next), count, error: null }
}

export function applyStaffCasesDelete(cases: HermesCase[], ids: string[], now = new Date().toISOString()) {
  const wanted = new Set(ids.filter((item) => item.startsWith("case-")))
  if (!wanted.size) return { cases, gone: [] as HermesCase[], count: 0, error: "empty" as const }
  const gone: HermesCase[] = []
  const next = cases.map((item) => {
    if (!wanted.has(item.id) || item.gone) return item
    const row = { ...item, gone: true, updatedAt: now }
    gone.push(row)
    return row
  })
  return { cases: sortHermesCases(next.filter((item) => !item.gone)), gone, count: gone.length, error: null }
}

export function progressRatio(progress: HermesProgress) {
  if (progress === "hold") return 0.42
  const index = PROGRESS_TRACK.indexOf(progress)
  if (index < 0) return 0
  return index / (PROGRESS_TRACK.length - 1)
}

export function factoryName(item: HermesCase) {
  return (item.factory || item.org || "").replace(/\s+/g, " ").trim()
}

export function ticketNo(item: HermesCase) {
  const stored = (item.ticketNo || "").replace(/\s+/g, "").trim()
  if (stored) return stored
  const day = (item.at || "").slice(0, 10).replace(/-/g, "") || "00000000"
  const tail = (item.id || "").replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || "0000"
  return `VA${day}-${tail.padStart(4, "0")}`
}

export function newTicketNo(cases: HermesCase[], at = new Date().toISOString()) {
  const day = at.slice(0, 10).replace(/-/g, "") || "00000000"
  const prefix = `VA${day}-`
  let max = 0
  for (const item of cases) {
    const no = ticketNo(item)
    if (!no.startsWith(prefix)) continue
    const n = Number(no.slice(prefix.length))
    if (Number.isFinite(n)) max = Math.max(max, n)
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`
}

function digits(value: string) {
  return value.replace(/\D/g, "")
}

export function matchDeskSearch(item: HermesCase, query: string) {
  const raw = query.replace(/\s+/g, " ").trim()
  if (!raw) return true
  const q = raw.toLowerCase()
  const no = ticketNo(item).toLowerCase()
  const org = `${item.org || ""} ${item.factory || ""}`.toLowerCase()
  const contact = (item.contact || "").toLowerCase()
  if (no.includes(q) || org.includes(q) || contact.includes(q)) return true
  const phone = digits(q)
  return phone.length >= 3 && digits(item.contact || "").includes(phone)
}

export function customerKey(item: HermesCase) {
  return item.visitorId || item.leadId || item.id
}

export function stageFill(progress: HermesProgress, step: HermesProgress) {
  if (progress === "hold") {
    const talking = PROGRESS_TRACK.indexOf("talking")
    const at = PROGRESS_TRACK.indexOf(step)
    if (at < 0) return 0
    if (at < talking) return 1
    if (step === "talking") return 0.4
    return 0
  }
  const current = PROGRESS_TRACK.indexOf(progress)
  const at = PROGRESS_TRACK.indexOf(step)
  if (current < 0 || at < 0) return 0
  if (at < current) return 1
  if (at === current) return progress === "closed" ? 1 : 0.58
  return 0
}

export function customerArchives(cases: HermesCase[]) {
  const map = new Map<string, HermesCase>()
  for (const item of cases.map(normalizeCase)) {
    const key = customerKey(item)
    const prev = map.get(key)
    if (!prev || prev.updatedAt < item.updatedAt) map.set(key, item)
  }
  return sortHermesCases([...map.values()])
}

export function ticketsForCustomer(cases: HermesCase[], key: string) {
  return sortHermesCases(cases.map(normalizeCase).filter((item) => customerKey(item) === key))
}

export function ticketsForFactory(cases: HermesCase[], name: string) {
  return sortHermesCases(cases.map(normalizeCase).filter((item) => factoryName(item) === name))
}

export function factoryArchives(cases: HermesCase[]) {
  const map = new Map<string, HermesCase[]>()
  for (const item of cases.map(normalizeCase)) {
    const name = factoryName(item)
    if (!name) continue
    map.set(name, [...(map.get(name) || []), item])
  }
  return [...map.entries()]
    .map(([name, rows]) => {
      const tickets = sortHermesCases(rows)
      return { name, count: tickets.length, latest: tickets[0], tickets }
    })
    .sort((a, b) => (a.latest.updatedAt < b.latest.updatedAt ? 1 : a.latest.updatedAt > b.latest.updatedAt ? -1 : 0))
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
  const factory = typeof item.factory === "string" ? item.factory.replace(/\s+/g, " ").trim() : ""
  return {
    ...item,
    factory: factory || undefined,
    ticketNo: ticketNo(item),
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
    color: asColor(item.color),
    category: asCategory(item.category),
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

export function asColor(value: unknown): CaseColor {
  return value === "red" || value === "orange" || value === "yellow" || value === "green" || value === "blue" || value === "purple"
    ? value
    : "none"
}

export function asCategory(value: unknown): CaseCategory {
  return value === "lead" || value === "inquiry" || value === "partner" || value === "sample" || value === "test" || value === "other"
    ? value
    : "unset"
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
    if (filter.color && filter.color !== "all" && (item.color || "none") !== filter.color) return false
    if (filter.category && filter.category !== "all" && (item.category || "unset") !== filter.category) return false
    return matchDeskSearch(item, query)
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
  return leads.filter((lead) => !findHermesCase(cases, { leadId: lead.id, contact: lead.contact || lead.email }))
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

export function attachLead(
  cases: HermesCase[],
  leads: Lead[],
  leadId: string,
  now = new Date().toISOString(),
  ledger: HermesLedger = emptyLedger(),
) {
  const lead = leads.find((item) => item.id === leadId)
  if (!lead) return { cases, case: null as HermesCase | null, ledger, error: "missing" as const }
  const live = liveCases(cases, ledger)
  const hit = findHermesCase(live, { leadId: lead.id, contact: lead.contact || lead.email })
  if (hit) return { cases: live, case: hit, ledger, error: "exists" as const }
  const created = caseFromLead(lead, now, live)
  return {
    cases: sortHermesCases([created, ...live]),
    case: created,
    ledger: reviveOnLedger(ledger, created, now),
    error: null,
  }
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
  inquiry?: InquiryState
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
    inquiry: hydrateInquiryState(options.inquiry || emptyInquiry()),
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
    ? "A team member has taken this conversation. Karmenai will step back. Leave your crop and tonnage here, and someone from the project will follow up."
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
  if ("factory" in raw) next.factory = clean(raw.factory, MAX.org) || undefined
  if (!next.ticketNo) next.ticketNo = ticketNo(item)
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
  if ("color" in raw) next.color = asColor(raw.color)
  if ("category" in raw) next.category = asCategory(raw.category)
  if ("lastChannel" in raw) {
    next.lastChannel =
      raw.lastChannel === "chat" || raw.lastChannel === "email" || raw.lastChannel === "form" ? raw.lastChannel : next.lastChannel
  }
  if (next.owner === "human") next.following = false
  return next
}

export function caseFromLead(lead: Lead, now = new Date().toISOString(), cases: HermesCase[] = []): HermesCase {
  const contact = lead.contact || lead.email || ""
  return {
    id: newHermesCaseId(),
    at: lead.at || now,
    updatedAt: now,
    name: lead.name || "未留称呼",
    org: lead.org || "",
    ticketNo: newTicketNo(cases, lead.at || now),
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
    category: "lead",
    ...emptyTelemetry(),
    lastChannel: lead.source === "ai" ? "chat" : "form",
  }
}

export function caseFromInquiryTask(task: InquiryTask, cases: HermesCase[] = [], now = new Date().toISOString()): HermesCase {
  return {
    id: newHermesCaseId(),
    at: now,
    updatedAt: now,
    name: task.name || "询单任务",
    org: "询单系统",
    ticketNo: newTicketNo(cases, now),
    contact: "",
    note: [task.instruction, task.targets.map((item) => item.label).join("、")].filter(Boolean).join(" · "),
    owner: "hermes",
    following: true,
    progress: "new",
    reaction: "",
    evaluation: "",
    energy: "unset",
    source: "manual",
    category: "inquiry",
    color: "blue",
    ...emptyTelemetry(),
    lastChannel: "unset",
    nextAction: "按条件找真实厂商",
  }
}

export type InquiryTaskActionResult = {
  inquiry: InquiryState
  cases: HermesCase[]
  ledger: HermesLedger
  touched: HermesCase[]
  gone: HermesCase[]
  assignMessage?: string
  caseId?: string
  event?: string
  error?: "empty" | "missing" | "cancelled" | "op"
}

function patchLinkedCase(
  cases: HermesCase[],
  caseId: string | undefined,
  patch: Partial<HermesCase>,
  now: string,
) {
  if (!caseId) return { cases, touched: [] as HermesCase[] }
  const touched: HermesCase[] = []
  const next = cases.map((item) => {
    if (item.id !== caseId || item.gone) return item
    const row = { ...item, ...patch, updatedAt: now }
    touched.push(row)
    return row
  })
  return { cases: next, touched }
}

function bindTaskCase(inquiry: InquiryState, cases: HermesCase[], task: InquiryTask, now: string, ledger: HermesLedger) {
  if (task.caseId) {
    const existing = cases.find((item) => item.id === task.caseId && !item.gone)
    if (existing) return { inquiry, cases, task, created: null as HermesCase | null }
    if (ledger.goneIds.includes(task.caseId)) {
      return { inquiry, cases, task, created: null as HermesCase | null }
    }
  }
  const rec = caseFromInquiryTask(task, cases, now)
  return {
    inquiry: attachTaskCase(inquiry, task.id, rec.id, now),
    cases: [rec, ...cases],
    task: { ...task, caseId: rec.id },
    created: rec,
  }
}

export function applyInquiryTaskAction(
  inquiry: InquiryState,
  cases: HermesCase[],
  ledger: HermesLedger,
  body: Record<string, unknown>,
  now = new Date().toISOString(),
): InquiryTaskActionResult {
  const empty: InquiryTaskActionResult = { inquiry, cases, ledger, touched: [], gone: [] }
  const op = typeof body.op === "string" ? body.op : ""
  const id = typeof body.id === "string" ? body.id : ""

  if (op === "create") {
    const created = createInquiryTask(inquiry, body, now)
    if (created.error || !created.task) return { ...empty, error: created.error || "empty" }
    const bound = bindTaskCase(created.state, cases, created.task, now, ledger)
    const active = created.task.status === "searching"
    const patched = active
      ? patchLinkedCase(bound.cases, bound.task.caseId, { progress: "talking", following: true, nextAction: "正在找真实厂商" }, now)
      : { cases: bound.cases, touched: [] as HermesCase[] }
    return {
      inquiry: bound.inquiry,
      cases: patched.cases,
      ledger,
      touched: [...(bound.created ? [bound.created] : []), ...patched.touched],
      gone: [],
      assignMessage: active ? buildTaskAssignMessage(bound.task) : undefined,
      caseId: bound.task.caseId,
      event: `询单：创建任务 ${created.task.name}`,
    }
  }

  if (op === "update") {
    const updated = updateInquiryTask(inquiry, { ...body, id }, now)
    if (updated.error || !updated.task) return { ...empty, error: updated.error || "missing" }
    const withTargets: InquiryState = {
      ...updated.state,
      targets: updated.task.targets.length ? updated.task.targets : updated.state.targets,
    }
    const bound = bindTaskCase(withTargets, cases, updated.task, now, ledger)
    const patched = patchLinkedCase(
      bound.cases,
      bound.task.caseId,
      {
        name: bound.task.name,
        note: [bound.task.instruction, bound.task.targets.map((item) => item.label).join("、")].filter(Boolean).join(" · "),
        nextAction: bound.task.enabled ? "按条件找真实厂商" : "已停用",
      },
      now,
    )
    return {
      inquiry: bound.inquiry,
      cases: patched.cases,
      ledger,
      touched: [...(bound.created ? [bound.created] : []), ...patched.touched],
      gone: [],
      caseId: bound.task.caseId,
      event: `询单：更新任务 ${bound.task.name}`,
    }
  }

  if (op === "select") {
    const hit = inquiry.tasks.find((item) => item.id === id)
    if (!hit) return { ...empty, error: "missing" }
    const selected: InquiryState = {
      ...inquiry,
      currentId: id,
      targets: hit.targets.length ? hit.targets : inquiry.targets,
    }
    const bound = bindTaskCase(selected, cases, hit, now, ledger)
    return {
      inquiry: bound.inquiry,
      cases: bound.cases,
      ledger,
      touched: bound.created ? [bound.created] : [],
      gone: [],
      caseId: bound.task.caseId,
    }
  }

  if (op === "start") {
    const started = startInquiryTask(inquiry, id, now)
    if (started.error || !started.task) return { ...empty, error: started.error || "missing" }
    const bound = bindTaskCase(started.state, cases, started.task, now, ledger)
    const patched = patchLinkedCase(
      bound.cases,
      bound.task.caseId,
      { progress: "talking", following: true, nextAction: "正在找真实厂商" },
      now,
    )
    return {
      inquiry: bound.inquiry,
      cases: patched.cases,
      ledger,
      touched: [...(bound.created ? [bound.created] : []), ...patched.touched],
      gone: [],
      assignMessage: buildTaskAssignMessage(bound.task),
      caseId: bound.task.caseId,
      event: `询单：开始 ${bound.task.name}`,
    }
  }

  if (op === "cancel") {
    const cancelled = cancelInquiryTask(inquiry, id, now)
    if (cancelled.error || !cancelled.task) return { ...empty, error: cancelled.error || "missing" }
    const patched = patchLinkedCase(
      cases,
      cancelled.task.caseId,
      { progress: "hold", following: false, nextAction: "已取消本轮" },
      now,
    )
    return {
      inquiry: cancelled.state,
      cases: patched.cases,
      ledger,
      touched: patched.touched,
      gone: [],
      caseId: cancelled.task.caseId,
      event: `询单：取消 ${cancelled.task.name}`,
    }
  }

  if (op === "delete") {
    const removed = deleteInquiryTask(inquiry, id)
    if (removed.error || !removed.task) return { ...empty, error: removed.error || "missing" }
    if (!removed.task.caseId) {
      return {
        inquiry: removed.state,
        cases,
        ledger,
        touched: [],
        gone: [],
        event: `询单：删除任务 ${removed.task.name}`,
      }
    }
    const deleted = applyStaffCasesDelete(cases, [removed.task.caseId], now)
    let nextLedger = ledger
    for (const item of deleted.gone) nextLedger = markGoneOnLedger(nextLedger, item, now)
    return {
      inquiry: removed.state,
      cases: deleted.cases,
      ledger: nextLedger,
      touched: [],
      gone: deleted.gone,
      event: `询单：删除任务 ${removed.task.name}`,
    }
  }

  return { ...empty, error: "op" }
}

export function upsertFromTicket(
  cases: HermesCase[],
  ticket: { name: string; org: string; contact: string; note: string },
  extra: { visitorId?: string; place?: string; leadId?: string; following?: boolean },
  now = new Date().toISOString(),
  ledger: HermesLedger = emptyLedger(),
) {
  if (
    isIdentitySuppressed(
      { visitorId: extra.visitorId, contact: ticket.contact, leadId: extra.leadId },
      ledger,
    )
  ) {
    return { cases, case: null as HermesCase | null }
  }
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
        ticketNo: newTicketNo(cases, now),
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
  ledger: HermesLedger = emptyLedger(),
) {
  if (isIdentitySuppressed({ visitorId }, ledger)) {
    return { cases, case: null as HermesCase | null }
  }
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
    ticketNo: newTicketNo(cases, now),
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

export function importLeads(cases: HermesCase[], leads: Lead[], now = new Date().toISOString(), ledger: HermesLedger = emptyLedger()) {
  let next = liveCases(cases, ledger)
  for (const lead of leads) {
    if (isLeadSuppressed(lead, ledger)) continue
    const hit = findHermesCase(next, { leadId: lead.id, contact: lead.contact || lead.email })
    if (hit) continue
    next = [caseFromLead(lead, now, next), ...next]
  }
  return sortHermesCases(next)
}

export function fileFinding(
  inquiry: InquiryState,
  cases: HermesCase[],
  findingId: string,
  now = new Date().toISOString(),
) {
  const finding = inquiry.findings.find((item) => item.id === findingId)
  if (!finding) return { inquiry, cases, case: null as HermesCase | null, error: "missing" as const }
  if (!finding.org || !finding.source) return { inquiry, cases, case: null, error: "unverified" as const }
  const existing =
    (finding.caseId && cases.find((item) => item.id === finding.caseId)) ||
    cases.find((item) => factoryName(item) === finding.org || item.org === finding.org)
  const note = [finding.pain, `来源：${finding.source}`].filter(Boolean).join(" · ")
  const created = existing
    ? patchHermesCase(
        existing,
        {
          factory: finding.org,
          org: existing.org || finding.org,
          place: finding.place || existing.place,
          contact: finding.contact || existing.contact,
          note: existing.note || note,
        },
        now,
      )
    : {
        id: newHermesCaseId(),
        at: now,
        updatedAt: now,
        name: finding.org,
        org: finding.org,
        factory: finding.org,
        ticketNo: newTicketNo(cases, now),
        contact: finding.contact || "",
        note,
        place: finding.place,
        owner: "hermes" as const,
        following: true,
        progress: "new" as const,
        reaction: "",
        evaluation: "",
        energy: "unset" as const,
        source: "manual" as const,
        category: "inquiry" as const,
        ...emptyTelemetry(),
        lastChannel: "unset" as const,
      }
  return {
    inquiry: {
      ...inquiry,
      findings: inquiry.findings.map((item) => (item.id === finding.id ? { ...item, caseId: created.id } : item)),
    },
    cases: sortHermesCases([created, ...cases.filter((item) => item.id !== created.id)]),
    case: created,
    error: null,
  }
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
  const cleaned = stripInquiryTags(stripDeskTags(reply))
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
      raw.factory ||
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
    if (!hit || hit.gone) continue
    const patched = patchHermesCase(hit, raw, now)
    next = [patched, ...next.filter((item) => item.id !== patched.id)]
  }
  return sortHermesCases(next)
}

const COACH_RULES = `你是皮纳图博火山灰项目的高级顾问 Karmenai。后台工作台和前台高级顾问是同一个人、同一份长期记忆，只是这里权限更高。对同事可以讲工作台；对客户只称 Karmenai，不要说 Hermes。

【后台权限】
- 能看全部真实客户档案、同事指令、desk 记忆、接管状态。
- 前台对话看不到这些。你在前台也不会、不能把工作台数据说出去。
- 不要编造客户。档案列表没有的人，就说还没有这场对话。

【控制权】
- 同事能通过工单列表改称呼、公司、联系方式、进度等基础字段；接管、邮件状态、跟单、跟踪、行为数据、记忆仍由你改。
- 同事说接管 / 交回 / 记邮件 / 改记忆，你用 <desk> 更新。一键接管也只能由你执行。

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
- factory 是工厂档案名称。每个真实客户一份客户档案，每家真实工厂一份工厂档案。没有厂名就留空，不要编。
- ticketNo 是系统工单号。已有的不要改，也不要自己编新号。
- 询单模块和工单模块是同一个工作台。同事选定的需求类型、家数上限、限时是硬性参数。按这些找真实厂商，到数即停，没有来源就不要写。询单只许起草，不许群发，不许写 sent。本站没有发信口。用 <inquiry> 更新寻找结果，可以和 <desk> 同时出现。
- 没有真实邮件或对话记录时，不要编发送成功、跟单、速度和摘要。
- 不要提 NAS、端口、网关、沙箱。`

export function caseBrief(item: HermesCase) {
  const contact = item.contact ? "已留联系方式" : "未留联系方式"
  return [
    `id=${item.id}`,
    `工单号=${ticketNo(item)}`,
    `称呼=${item.name}`,
    item.org ? `机构=${item.org}` : "",
    factoryName(item) ? `工厂=${factoryName(item)}` : "工厂=尚未建档",
    `跟进方=${item.owner === "human" ? "人工" : "Karmenai"}`,
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
  inquiry?: InquiryState,
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
  const inquiryBlock = inquiryCoachExtra(inquiry || emptyInquiry())
  const system = `${COACH_RULES}\n\n【当前客户档案】\n${roster}\n\n${inquiryBlock}${memoryBlock ? `\n\n${memoryBlock}` : ""}${extra ? `\n\n${extra}` : ""}`
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
  inquiry?: InquiryState,
) {
  const currentInquiry = inquiry || emptyInquiry()
  const hermes = hermesEnvFrom(env)
  if (!hermes) {
    return { reply: coachUnavailableReply(), cases, memory, inquiry: currentInquiry, source: "local" as const }
  }
  try {
    const raw = await completeChatCompletions(hermes, buildCoachMessages(cases, history, undefined, memory, currentInquiry), {
      hosts: "exact",
      images,
    })
    if (raw) {
      const parsed = extractDeskUpdates(raw)
      const inquiryPatch = extractInquiryUpdates(raw)
      const reply = stripInquiryTags(parsed.reply)
      if (reply) {
        return {
          reply,
          cases: applyDeskUpdates(cases, parsed.updates),
          memory: parsed.memory && memory ? applyMemoryPatch(memory, parsed.memory) : memory,
          inquiry: applyInquiryState(currentInquiry, inquiryPatch),
          source: "hermes" as const,
        }
      }
    }
  } catch (error) {
    console.error("ash-hermes-desk coach", error)
  }
  return { reply: coachUnavailableReply(), cases, memory, inquiry: currentInquiry, source: "local" as const }
}
