export type InquiryOutreach = "none" | "draft" | "queued" | "sent" | "blocked"
export type InquiryJobStatus = "idle" | "searching" | "review" | "drafting" | "paused"

export type InquiryTarget = {
  id: string
  label: string
  at: string
}

export type InquiryFinding = {
  id: string
  at: string
  org: string
  place?: string
  pain?: string
  source?: string
  contact?: string
  outreach: InquiryOutreach
  draft?: string
}

export type InquiryJob = {
  status: InquiryJobStatus
  brief: string
  updatedAt: string
}

export type InquiryState = {
  targets: InquiryTarget[]
  findings: InquiryFinding[]
  job: InquiryJob
}

export const OUTREACH_LABEL: Record<InquiryOutreach, string> = {
  none: "尚未起草",
  draft: "已起草",
  queued: "待发送",
  sent: "已发送",
  blocked: "已拦住",
}

export const JOB_LABEL: Record<InquiryJobStatus, string> = {
  idle: "未安排",
  searching: "正在寻找",
  review: "待核对",
  drafting: "在起草",
  paused: "已暂停",
}

export const INQUIRY_RUN = [
  { key: "collect", label: "取条件" },
  { key: "source", label: "找来源" },
  { key: "verify", label: "核实" },
  { key: "draft", label: "起草稿" },
] as const

export type InquiryRunFill = "done" | "now" | "wait"

export function inquiryRunIndex(status: InquiryJobStatus, targetCount: number) {
  if (status === "drafting") return 3
  if (status === "review") return 2
  if (status === "searching") return 1
  if (status === "paused") return targetCount > 0 ? 1 : 0
  if (targetCount > 0) return 0
  return -1
}

export function inquiryStepFill(status: InquiryJobStatus, targetCount: number, step: number): InquiryRunFill {
  const index = inquiryRunIndex(status, targetCount)
  if (index < 0 || step < 0) return "wait"
  if (status === "idle") return step <= index ? "done" : "wait"
  if (step < index) return "done"
  if (step === index) return "now"
  return "wait"
}

export function inquiryRunHint(status: InquiryJobStatus, targetCount: number) {
  if (status === "paused") return "已暂停。同事再说一声再继续。"
  if (status === "drafting") return "来源已核实，正在起草询单。"
  if (status === "review") return "正在核实来源，只收可查证的厂商。"
  if (status === "searching") return "正在找可查证的来源，没有来源不建档。"
  if (targetCount > 0) return "条件已记下，还没开始找。"
  return "先设定弊端或对口类型。"
}

export function emptyInquiryJob(): InquiryJob {
  return { status: "idle", brief: "", updatedAt: "" }
}

export function emptyInquiry(): InquiryState {
  return { targets: [], findings: [], job: emptyInquiryJob() }
}

export function hydrateInquiryState(raw: unknown): InquiryState {
  const base = emptyInquiry()
  if (!raw || typeof raw !== "object") return base
  const row = raw as Record<string, unknown>
  const jobRaw = row.job && typeof row.job === "object" ? (row.job as Record<string, unknown>) : null
  return {
    targets: Array.isArray(row.targets)
      ? row.targets.flatMap((item) => {
          if (!item || typeof item !== "object") return []
          const target = item as Record<string, unknown>
          const id = clean(target.id, 80)
          const label = sanitizeTargetLabel(target.label)
          if (!id || !label) return []
          return [{ id, label, at: clean(target.at, 40) }]
        })
      : base.targets,
    findings: Array.isArray(row.findings)
      ? row.findings.map((item) => sanitizeFinding(item)).filter((item): item is InquiryFinding => Boolean(item))
      : base.findings,
    job: jobRaw
      ? {
          status: asJobStatus(jobRaw.status),
          brief: clean(jobRaw.brief, 800),
          updatedAt: clean(jobRaw.updatedAt, 40),
        }
      : base.job,
  }
}

export function newInquiryId(prefix: string, now = Date.now()) {
  return `${prefix}-${String(now).padStart(15, "0")}-${Math.random().toString(36).slice(2, 8)}`
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

export function sanitizeTargetLabel(raw: unknown) {
  return clean(raw, 80)
}

export function addInquiryTarget(targets: InquiryTarget[], label: string, now = new Date().toISOString()) {
  const text = sanitizeTargetLabel(label)
  if (!text) return { targets, error: "empty" as const }
  if (targets.some((item) => item.label === text)) return { targets, error: "exists" as const }
  return {
    targets: [...targets, { id: newInquiryId("tg"), label: text, at: now }],
    error: null,
  }
}

export function removeInquiryTarget(targets: InquiryTarget[], id: string) {
  return targets.filter((item) => item.id !== id)
}

export function applyTargetWrite(targets: InquiryTarget[], raw: Record<string, unknown>, now = new Date().toISOString()) {
  if (typeof raw.remove === "string" && raw.remove) {
    return { targets: removeInquiryTarget(targets, raw.remove), error: null }
  }
  if (typeof raw.add === "string") return addInquiryTarget(targets, raw.add, now)
  return { targets, error: "empty" as const }
}

function asOutreach(value: unknown): InquiryOutreach {
  if (value === "sent") return "draft"
  return value === "draft" || value === "queued" || value === "blocked" || value === "none" ? value : "none"
}

function asJobStatus(value: unknown): InquiryJobStatus {
  return value === "searching" || value === "review" || value === "drafting" || value === "paused" || value === "idle"
    ? value
    : "idle"
}

export function sanitizeFinding(raw: unknown, now = new Date().toISOString()): InquiryFinding | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const org = clean(row.org, 200)
  const source = clean(row.source, 240)
  if (!org || !source) return null
  return {
    id: clean(row.id, 80) || newInquiryId("find"),
    at: clean(row.at, 40) || now,
    org,
    place: clean(row.place, 80) || undefined,
    pain: clean(row.pain, 120) || undefined,
    source,
    contact: clean(row.contact, 200) || undefined,
    outreach: asOutreach(row.outreach),
    draft: clean(row.draft, 2000) || undefined,
  }
}

export function applyInquiryFindings(current: InquiryFinding[], raw: unknown[], now = new Date().toISOString()) {
  let next = [...current]
  for (const item of raw) {
    const finding = sanitizeFinding(item, now)
    if (!finding) continue
    next = [finding, ...next.filter((row) => row.id !== finding.id && row.org !== finding.org)]
  }
  return next
}

export function applyInquiryJob(current: InquiryJob, raw: unknown, now = new Date().toISOString()): InquiryJob {
  if (!raw || typeof raw !== "object") return current
  const row = raw as Record<string, unknown>
  return {
    status: "status" in row ? asJobStatus(row.status) : current.status,
    brief: "brief" in row ? clean(row.brief, 800) : current.brief,
    updatedAt: now,
  }
}

export function applyInquiryState(current: InquiryState, raw: { findings?: unknown[]; job?: unknown }, now = new Date().toISOString()): InquiryState {
  return {
    targets: current.targets,
    findings: Array.isArray(raw.findings) ? applyInquiryFindings(current.findings, raw.findings, now) : current.findings,
    job: raw.job ? applyInquiryJob(current.job, raw.job, now) : current.job,
  }
}

const INQUIRY_RE = /<inquiry>([\s\S]*?)<\/inquiry>/i

export function stripInquiryTags(text: string) {
  return text.replace(INQUIRY_RE, "").replace(/<\/?inquiry>/gi, "").trim()
}

export function extractInquiryUpdates(reply: string): {
  reply: string
  findings: Record<string, unknown>[]
  job?: Record<string, unknown>
} {
  const match = reply.match(INQUIRY_RE)
  const cleaned = stripInquiryTags(reply)
  if (!match) return { reply: cleaned, findings: [] }
  try {
    const raw = JSON.parse(match[1]) as Record<string, unknown>
    const findings = Array.isArray(raw.findings)
      ? (raw.findings.filter((item) => item && typeof item === "object") as Record<string, unknown>[])
      : []
    const job = raw.job && typeof raw.job === "object" ? (raw.job as Record<string, unknown>) : undefined
    return { reply: cleaned, findings, job }
  } catch {
    return { reply: cleaned, findings: [] }
  }
}

export function inquiryCoachExtra(state: InquiryState) {
  const targetLines = state.targets.length
    ? state.targets.map((item) => `- ${item.label}`).join("\n")
    : "同事还没设定任何弊端或对口类型。先请他们设定，不要自己编。"
  const findLines = state.findings.length
    ? state.findings
        .slice(0, 40)
        .map((item) => `- ${item.org}；来源=${item.source || "尚无"}；沟通=${OUTREACH_LABEL[item.outreach]}`)
        .join("\n")
    : "还没有真实找到的厂商。"
  const jobLine = `${JOB_LABEL[state.job.status]}${state.job.brief ? `。${state.job.brief}` : ""}`
  return [
    "【询单模块（同一工作台、同一 Hermes）】",
    "- 同事设定要找的厂商弊端或对口类型。你按这些条件找真实厂商。",
    "- 没有真实来源就不要写厂商。不要编公司名、电话、邮箱、网址。",
    "- 找到的每一条必须带 source。询单只许起草，不许群发，不许写 sent。",
    "- 广告投放以后再做。看板进度是：取条件 → 找来源 → 核实 → 起草稿。开始找写 searching，核实时 review，起草时 drafting。",
    "- 更新寻找结果时另起一行：",
    '<inquiry>{"job":{"status":"review","brief":"本轮条件"},"findings":[{"org":"真实厂名","place":"地区","pain":"弊端","source":"来源","outreach":"draft","draft":"询单草稿"}]}</inquiry>',
    "",
    `【要找的弊端 / 对口类型】\n${targetLines}`,
    `【当前询单任务】${jobLine}`,
    `【已找到的厂商】\n${findLines}`,
  ].join("\n")
}
