import { completeChatCompletions } from "./chatCompletions"
import { hermesEnvFrom } from "./hermes"
import type { Lead } from "./leads"

export type HermesOwner = "hermes" | "human"
export type HermesEnergy = "high" | "mid" | "low" | "unset"
export type HermesProgress = "new" | "contacted" | "talking" | "sample" | "negotiate" | "hold" | "closed"

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
}

export type HermesCoachTurn = {
  id: string
  at: string
  role: "staff" | "hermes"
  content: string
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
    cases: filterHermesCases(options.cases, options.filter),
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
    const next = patchHermesCase(
      existing,
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

export function extractDeskUpdates(reply: string): { reply: string; updates: Record<string, unknown>[] } {
  const match = reply.match(DESK_RE)
  const cleaned = stripDeskTags(reply)
  if (!match) return { reply: cleaned, updates: [] }
  try {
    const raw = JSON.parse(match[1]) as Record<string, unknown>
    if (Array.isArray(raw.updates)) {
      return { reply: cleaned, updates: raw.updates.filter((item) => item && typeof item === "object") as Record<string, unknown>[] }
    }
    if (raw.id || raw.progress || raw.energy || raw.reaction || raw.evaluation || "following" in raw) {
      return { reply: cleaned, updates: [raw] }
    }
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

【你能做的】
- 根据同事的意图，说明你会怎么跟进哪些客户、话术怎么改、谁先谁后。
- 用短段纯文本，不要 Markdown。
- 向同事汇报时默认隐藏邮箱和其他隐私联系方式，只写称呼、机构、作物、区域、吨位和跟进事项。
- 需要改档案时，先用正常的话说明改了什么，再在回复最后另起一行输出：
  <desk>{"updates":[{"id":"客户档案id","following":true,"progress":"talking","reaction":"客户反响","evaluation":"你的评价","energy":"high"}]}</desk>
- progress 只能是 new / contacted / talking / sample / negotiate / hold / closed。
- energy 只能是 high / mid / low / unset。
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
  const live = cases.filter((item) => isLiveCase(item))
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
    content: item.content.slice(0, 4000),
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
) {
  const hermes = hermesEnvFrom(env)
  if (!hermes) {
    return { reply: coachUnavailableReply(), cases, source: "local" as const }
  }
  try {
    const raw = await completeChatCompletions(hermes, buildCoachMessages(cases, history, undefined, memory), {
      hosts: "exact",
    })
    if (raw) {
      const parsed = extractDeskUpdates(raw)
      if (parsed.reply) {
        return { reply: parsed.reply, cases: applyDeskUpdates(cases, parsed.updates), source: "hermes" as const }
      }
    }
  } catch (error) {
    console.error("ash-hermes-desk coach", error)
  }
  return { reply: coachUnavailableReply(), cases, source: "local" as const }
}
