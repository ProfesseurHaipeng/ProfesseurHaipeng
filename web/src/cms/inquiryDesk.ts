export type InquiryOutreach = "none" | "draft" | "queued" | "sent" | "blocked"
export type InquiryJobStatus = "idle" | "searching" | "review" | "drafting" | "paused"
export type InquiryTaskStatus = InquiryJobStatus | "cancelled" | "done" | "timeout"
export type InquiryScheduleKind = "once" | "hourly" | "daily" | "weekdays" | "weekly" | "monthly" | "interval"

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
  caseId?: string
}

export type InquiryJob = {
  status: InquiryJobStatus
  brief: string
  updatedAt: string
}

export type InquirySchedule = {
  kind: InquiryScheduleKind
  hour?: number
  intervalHours?: number
}

export type InquiryRunRecord = {
  id: string
  at: string
  status: "started" | "done" | "cancelled" | "timeout" | "noted"
  note?: string
}

export type InquiryTask = {
  id: string
  name: string
  instruction: string
  targets: InquiryTarget[]
  enabled: boolean
  status: InquiryTaskStatus
  schedule: InquirySchedule
  limitHours?: number
  quota: number
  startedAt?: string
  dueAt?: string
  caseId?: string
  brief: string
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  nextRunAt?: string
  runs: InquiryRunRecord[]
}

export type InquiryState = {
  targets: InquiryTarget[]
  findings: InquiryFinding[]
  job: InquiryJob
  tasks: InquiryTask[]
  currentId?: string
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

export const TASK_LABEL: Record<InquiryTaskStatus, string> = {
  ...JOB_LABEL,
  cancelled: "已取消",
  done: "已结束",
  timeout: "已到时",
}

export const SCHEDULE_KIND: { key: InquiryScheduleKind; label: string }[] = [
  { key: "once", label: "只跑这一次" },
  { key: "hourly", label: "每小时" },
  { key: "daily", label: "每天" },
  { key: "weekdays", label: "工作日" },
  { key: "weekly", label: "每周" },
  { key: "monthly", label: "每月" },
  { key: "interval", label: "间隔" },
]

export const LIMIT_HOURS = [1, 6, 12, 24, 48, 72] as const

export const FIND_QUOTAS = [3, 5, 8, 12, 20] as const

export const NEED_PRESETS: { group: "type" | "pain"; label: string }[] = [
  { group: "type", label: "化妆品厂家" },
  { group: "type", label: "农产品 / 农业" },
  { group: "type", label: "农村合作社" },
  { group: "type", label: "肥料 / 土壤改良厂家" },
  { group: "type", label: "水稻加工厂" },
  { group: "type", label: "茶叶基地" },
  { group: "pain", label: "土壤板结" },
  { group: "pain", label: "化肥成本高" },
  { group: "pain", label: "有机肥短缺" },
]

export function asQuota(value: unknown, fallback = 8) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(40, Math.max(1, Math.round(n)))
}

export function scheduleLabel(schedule: InquirySchedule) {
  const base = SCHEDULE_KIND.find((item) => item.key === schedule.kind)?.label || "只跑这一次"
  if (schedule.kind === "interval") return `每 ${schedule.intervalHours || 6} 小时`
  if (schedule.kind === "daily" || schedule.kind === "weekdays" || schedule.kind === "weekly" || schedule.kind === "monthly") {
    return `${base} ${String(schedule.hour ?? 9).padStart(2, "0")}:00`
  }
  return base
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
  return { targets: [], findings: [], job: emptyInquiryJob(), tasks: [] }
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
    tasks: Array.isArray(row.tasks) ? row.tasks.map((item) => sanitizeTask(item)).filter((item): item is InquiryTask => Boolean(item)) : [],
    currentId: clean(row.currentId, 80) || undefined,
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

function asTaskStatus(value: unknown): InquiryTaskStatus {
  if (value === "cancelled" || value === "done" || value === "timeout") return value
  return asJobStatus(value)
}

function asSchedule(raw: unknown): InquirySchedule {
  if (!raw || typeof raw !== "object") return { kind: "once" }
  const row = raw as Record<string, unknown>
  const kind =
    row.kind === "hourly" ||
    row.kind === "daily" ||
    row.kind === "weekdays" ||
    row.kind === "weekly" ||
    row.kind === "monthly" ||
    row.kind === "interval" ||
    row.kind === "once"
      ? row.kind
      : "once"
  const hour = typeof row.hour === "number" && row.hour >= 0 && row.hour <= 23 ? Math.round(row.hour) : 9
  const intervalHours =
    typeof row.intervalHours === "number" && row.intervalHours >= 1 && row.intervalHours <= 168
      ? Math.round(row.intervalHours)
      : 6
  return { kind, hour, intervalHours }
}

function sanitizeTask(raw: unknown): InquiryTask | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const id = clean(row.id, 80)
  if (!id) return null
  const targets = Array.isArray(row.targets)
    ? row.targets.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const target = item as Record<string, unknown>
        const tid = clean(target.id, 80)
        const label = sanitizeTargetLabel(target.label)
        if (!tid || !label) return []
        return [{ id: tid, label, at: clean(target.at, 40) }]
      })
    : []
  const runs: InquiryRunRecord[] = Array.isArray(row.runs)
    ? row.runs.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const run = item as Record<string, unknown>
        const rid = clean(run.id, 80)
        const at = clean(run.at, 40)
        const status: InquiryRunRecord["status"] =
          run.status === "started" ||
          run.status === "done" ||
          run.status === "cancelled" ||
          run.status === "timeout" ||
          run.status === "noted"
            ? run.status
            : "noted"
        if (!rid || !at) return []
        return [{ id: rid, at, status, note: clean(run.note, 200) || undefined }]
      })
    : []
  const limitHours = typeof row.limitHours === "number" && row.limitHours > 0 ? Math.min(168, Math.round(row.limitHours)) : undefined
  return {
    id,
    name: clean(row.name, 80) || "询单任务",
    instruction: clean(row.instruction, 2000),
    targets,
    enabled: row.enabled !== false,
    status: asTaskStatus(row.status),
    schedule: asSchedule(row.schedule),
    limitHours,
    quota: asQuota(row.quota, 8),
    startedAt: clean(row.startedAt, 40) || undefined,
    dueAt: clean(row.dueAt, 40) || undefined,
    caseId: clean(row.caseId, 80) || undefined,
    brief: clean(row.brief, 800),
    createdAt: clean(row.createdAt, 40),
    updatedAt: clean(row.updatedAt, 40),
    lastRunAt: clean(row.lastRunAt, 40) || undefined,
    nextRunAt: clean(row.nextRunAt, 40) || undefined,
    runs: runs.slice(-20),
  }
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
    caseId: clean(row.caseId, 80) || undefined,
  }
}

export function applyInquiryFindings(current: InquiryFinding[], raw: unknown[], now = new Date().toISOString()) {
  let next = [...current]
  for (const item of raw) {
    const finding = sanitizeFinding(item, now)
    if (!finding) continue
    const prev = next.find((row) => row.id === finding.id || row.org === finding.org)
    if (prev?.caseId && !finding.caseId) finding.caseId = prev.caseId
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
  const job = raw.job ? applyInquiryJob(current.job, raw.job, now) : current.job
  const currentId = current.currentId
  return {
    targets: current.targets,
    findings: Array.isArray(raw.findings) ? applyInquiryFindings(current.findings, raw.findings, now) : current.findings,
    job,
    tasks: (current.tasks || []).map((task) =>
      task.id === currentId
        ? { ...task, status: asTaskStatus(job.status), brief: job.brief, updatedAt: now }
        : task,
    ),
    currentId,
  }
}

export function applyStaffJob(
  current: InquiryJob,
  targets: InquiryTarget[],
  status: unknown,
  now = new Date().toISOString(),
) {
  if (status !== "searching" && status !== "paused" && status !== "idle") {
    return { job: current, error: "hermes-only" as const }
  }
  if (status === "searching" && targets.length === 0) return { job: current, error: "empty" as const }
  return {
    job: {
      status,
      brief: targets.map((item) => item.label).join("、") || current.brief,
      updatedAt: now,
    },
    error: null,
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

export function buildInquiryAssignMessage(targets: InquiryTarget[]) {
  const list = targets.map((item) => item.label).join("、")
  return list
    ? `按这些厂商弊端 / 对口类型去找真实厂商：${list}。流程按 取条件 → 找来源 → 核实 → 起草稿。没有来源不要编。找到后只起草询单，不要群发。`
    : "先记下：同事还没设定弊端。请提醒他们先设定要找的厂商类型，不要编造厂商。"
}

export type InquiryPromptPreview = {
  userMessage: string
  systemExcerpt: string
  targetCount: number
  findingCount: number
  jobLabel: string
}

export function taskJobStatus(status: InquiryTaskStatus): InquiryJobStatus {
  if (status === "cancelled" || status === "done" || status === "timeout") return "paused"
  return status
}

export function inquiryPromptPreview(state: InquiryState): InquiryPromptPreview {
  const extra = inquiryCoachExtra(state)
  const lines = extra.split("\n")
  const excerpt = lines.slice(0, 20).join("\n")
  const task = currentInquiryTask(state)
  const targets = task?.targets.length ? task.targets : state.targets
  return {
    userMessage: task ? buildTaskAssignMessage(task) : buildInquiryAssignMessage(targets),
    systemExcerpt: excerpt + (lines.length > 12 ? "\n…" : ""),
    targetCount: targets.length,
    findingCount: state.findings.length,
    jobLabel: task
      ? `${TASK_LABEL[task.status]}${task.brief ? ` · ${task.brief}` : ""}`
      : `${JOB_LABEL[state.job.status]}${state.job.brief ? ` · ${state.job.brief}` : ""}`,
  }
}

export function inquiryCoachExtra(state: InquiryState) {
  const currentTask = currentInquiryTask(state)
  const wants = currentTask?.targets.length ? currentTask.targets : state.targets
  const targetLines = wants.length
    ? wants.map((item) => `- ${item.label}`).join("\n")
    : "同事还没设定任何需求类型。先请他们设定，不要自己编。"
  const findLines = state.findings.length
    ? state.findings
        .slice(0, 40)
        .map((item) => `- ${item.org}；来源=${item.source || "尚无"}；沟通=${OUTREACH_LABEL[item.outreach]}`)
        .join("\n")
    : "还没有真实找到的厂商。"
  const jobLine = `${JOB_LABEL[state.job.status]}${state.job.brief ? `。${state.job.brief}` : ""}`
  return [
    "【询单模块（同一工作台、同一 Linda）】",
    "- 同事选定的需求类型、家数上限、限时都是硬性参数。按这些去网上找真实厂商，到数即停，到点即停。",
    "- 没有真实来源就不要写厂商。不要编公司名、电话、邮箱、网址。",
    "- 找到的每一条必须带 source，并尽量写下官网、联系方式或邮箱。询单只许起草，不许群发，不许写 sent。本站没有发信口。",
    "- 对口时用本站皮纳图博火山灰农业项目的真实内容，不要编项目参数。",
    "- 看板进度是：取条件 → 找来源 → 核实 → 起草稿。开始找写 searching，核实时 review，起草时 drafting。",
    "- 更新寻找结果时另起一行：",
    '<inquiry>{"job":{"status":"review","brief":"本轮条件"},"findings":[{"org":"真实厂名","place":"地区","pain":"弊端","source":"来源","contact":"公开联系方式","outreach":"draft","draft":"询单草稿"}]}</inquiry>',
    "",
    `【要找的弊端 / 对口类型】\n${targetLines}`,
    `【当前询单任务】${jobLine}`,
    currentTask
      ? [
          `【本轮硬性参数】这些是同事定下的，必须遵守，不够不要编。`,
          `名称=${currentTask.name}`,
          `需求=${currentTask.targets.map((item) => item.label).join("、") || "尚未选定"}`,
          `家数上限=${currentTask.quota || 8}。找到这么多家带真实来源的就停；不够就如实写还差几家。`,
          `限时=${currentTask.limitHours ? `${currentTask.limitHours} 小时` : "不限"}`,
          `节奏=${scheduleLabel(currentTask.schedule)}`,
          `工单=${currentTask.caseId || "尚未建档"}`,
          "触达=找到官网、可核验来源、联系方式或邮箱后只起草询单邮件。本站没有发信口，outreach 只能写 draft，不许写 sent。",
          "对口时按本站皮纳图博火山灰农业项目的真实内容，不要编项目参数。",
        ].join("；")
      : "",
    `【已找到的厂商】\n${findLines}`,
  ]
    .filter(Boolean)
    .join("\n")
}

export function currentInquiryTask(state: InquiryState) {
  const tasks = state.tasks || []
  return tasks.find((item) => item.id === state.currentId) || tasks[0]
}

export function migrateInquiryTasks(state: InquiryState, now = new Date().toISOString()) {
  if (state.tasks.length) return { state, changed: false }
  if (!state.targets.length && state.job.status === "idle") return { state, changed: false }
  const task: InquiryTask = {
    id: newInquiryId("task"),
    name: state.job.brief || "询单任务",
    instruction: "",
    targets: state.targets,
    enabled: true,
    status: asTaskStatus(state.job.status),
    schedule: { kind: "once" },
    quota: 8,
    brief: state.job.brief,
    createdAt: now,
    updatedAt: now,
    runs: [],
  }
  return { state: { ...state, tasks: [task], currentId: task.id }, changed: true }
}

export function nextInquiryRunAt(schedule: InquirySchedule, from = new Date().toISOString()) {
  if (schedule.kind === "once") return undefined
  const start = new Date(from)
  if (Number.isNaN(start.getTime())) return undefined
  const hour = schedule.hour ?? 9
  if (schedule.kind === "hourly") {
    start.setHours(start.getHours() + 1)
    return start.toISOString()
  }
  if (schedule.kind === "interval") {
    start.setHours(start.getHours() + (schedule.intervalHours || 6))
    return start.toISOString()
  }
  const next = new Date(start)
  next.setMinutes(0, 0, 0)
  next.setHours(hour)
  if (next.getTime() <= start.getTime()) next.setDate(next.getDate() + 1)
  if (schedule.kind === "weekdays") {
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1)
  }
  if (schedule.kind === "weekly") {
    next.setDate(next.getDate() + (next.getTime() <= start.getTime() ? 7 : 0))
  }
  if (schedule.kind === "monthly") {
    if (next.getTime() <= start.getTime()) next.setMonth(next.getMonth() + 1)
  }
  return next.toISOString()
}

export function taskDueAt(limitHours: number | undefined, startedAt: string) {
  if (!limitHours) return undefined
  const start = Date.parse(startedAt)
  if (!Number.isFinite(start)) return undefined
  return new Date(start + limitHours * 3600 * 1000).toISOString()
}

export function taskIsDue(task: InquiryTask, now = new Date().toISOString()) {
  if (!task.enabled || task.status === "cancelled" || task.status === "searching") return false
  return Boolean(task.nextRunAt && task.nextRunAt <= now)
}

export function tickInquiryTasks(state: InquiryState, now = new Date().toISOString()) {
  let changed = false
  const tasks = state.tasks.map((task) => {
    if ((task.status === "searching" || task.status === "review" || task.status === "drafting") && task.dueAt && task.dueAt <= now) {
      changed = true
      return {
        ...task,
        status: "timeout" as const,
        enabled: task.schedule.kind !== "once" && task.enabled,
        updatedAt: now,
        runs: [
          ...task.runs,
          { id: newInquiryId("run"), at: now, status: "timeout" as const, note: "已到限时，本轮停止。" },
        ].slice(-20),
      }
    }
    return task
  })
  const current = tasks.find((item) => item.id === state.currentId)
  const job =
    current && current.status !== state.job.status
      ? {
          status:
            current.status === "timeout" || current.status === "cancelled" || current.status === "done"
              ? ("paused" as const)
              : asJobStatus(current.status),
          brief: current.brief || state.job.brief,
          updatedAt: now,
        }
      : state.job
  if (job !== state.job) changed = true
  return { state: { ...state, tasks, job }, changed }
}

function pushRun(task: InquiryTask, status: InquiryRunRecord["status"], note: string, now: string): InquiryTask {
  return {
    ...task,
    runs: [...task.runs, { id: newInquiryId("run"), at: now, status, note }].slice(-20),
  }
}

export function createInquiryTask(state: InquiryState, raw: Record<string, unknown>, now = new Date().toISOString()) {
  const name = clean(raw.name, 80)
  const instruction = clean(raw.instruction, 2000)
  const fromDraft = Array.isArray(raw.targets)
    ? raw.targets.flatMap((item) => {
        const label = sanitizeTargetLabel(typeof item === "string" ? item : (item as { label?: unknown }).label)
        return label ? [{ id: newInquiryId("tg"), label, at: now }] : []
      })
    : state.targets
  if (!name) return { state, error: "empty" as const }
  if (!fromDraft.length && !instruction) return { state, error: "empty" as const }
  const schedule = asSchedule(raw.schedule)
  const limitHours = typeof raw.limitHours === "number" && raw.limitHours > 0 ? Math.min(168, Math.round(raw.limitHours)) : undefined
  const start = raw.start === true
  const task: InquiryTask = {
    id: newInquiryId("task"),
    name,
    instruction,
    targets: fromDraft,
    enabled: raw.enabled !== false,
    status: start ? "searching" : "idle",
    schedule,
    limitHours,
    quota: asQuota(raw.quota, 8),
    startedAt: start ? now : undefined,
    dueAt: start ? taskDueAt(limitHours, now) : undefined,
    brief: fromDraft.map((item) => item.label).join("、") || instruction.slice(0, 80),
    createdAt: now,
    updatedAt: now,
    lastRunAt: start ? now : undefined,
    nextRunAt: start ? nextInquiryRunAt(schedule, now) : nextInquiryRunAt(schedule, now),
    runs: start ? [{ id: newInquiryId("run"), at: now, status: "started", note: "同事开始这一轮询单。" }] : [],
  }
  const next: InquiryState = {
    ...state,
    targets: fromDraft.length ? fromDraft : state.targets,
    job: start
      ? { status: "searching", brief: task.brief, updatedAt: now }
      : state.job,
    tasks: [task, ...state.tasks],
    currentId: task.id,
  }
  return { state: next, task, error: null }
}

export function attachTaskCase(state: InquiryState, taskId: string, caseId: string, now = new Date().toISOString()) {
  return {
    ...state,
    tasks: state.tasks.map((item) => (item.id === taskId ? { ...item, caseId, updatedAt: now } : item)),
  }
}

export function updateInquiryTask(state: InquiryState, raw: Record<string, unknown>, now = new Date().toISOString()) {
  const id = typeof raw.id === "string" ? raw.id : ""
  const hit = state.tasks.find((item) => item.id === id)
  if (!hit) return { state, error: "missing" as const }
  const next: InquiryTask = {
    ...hit,
    name: "name" in raw ? clean(raw.name, 80) || hit.name : hit.name,
    instruction: "instruction" in raw ? clean(raw.instruction, 2000) : hit.instruction,
    enabled: "enabled" in raw ? raw.enabled !== false : hit.enabled,
    schedule: "schedule" in raw ? asSchedule(raw.schedule) : hit.schedule,
    limitHours: "limitHours" in raw
      ? typeof raw.limitHours === "number" && raw.limitHours > 0
        ? Math.min(168, Math.round(raw.limitHours))
        : undefined
      : hit.limitHours,
    quota: "quota" in raw ? asQuota(raw.quota, hit.quota || 8) : hit.quota || 8,
    targets: Array.isArray(raw.targets)
      ? raw.targets.flatMap((item) => {
          const label = sanitizeTargetLabel(typeof item === "string" ? item : (item as { label?: unknown }).label)
          return label ? [{ id: newInquiryId("tg"), label, at: now }] : []
        })
      : hit.targets,
    updatedAt: now,
  }
  if ("schedule" in raw) next.nextRunAt = nextInquiryRunAt(next.schedule, now)
  return {
    state: {
      ...state,
      tasks: state.tasks.map((item) => (item.id === id ? next : item)),
      currentId: id,
    },
    task: next,
    error: null,
  }
}

export function startInquiryTask(state: InquiryState, id: string, now = new Date().toISOString()) {
  const hit = state.tasks.find((item) => item.id === id)
  if (!hit) return { state, error: "missing" as const }
  if (hit.status === "cancelled") return { state, error: "cancelled" as const }
  if (!hit.targets.length && !hit.instruction) return { state, error: "empty" as const }
  const next = pushRun(
    {
      ...hit,
      enabled: true,
      status: "searching",
      startedAt: now,
      dueAt: taskDueAt(hit.limitHours, now),
      lastRunAt: now,
      nextRunAt: nextInquiryRunAt(hit.schedule, now),
      brief: hit.targets.map((item) => item.label).join("、") || hit.instruction.slice(0, 80),
      updatedAt: now,
    },
    "started",
    "同事开始这一轮询单。",
    now,
  )
  return {
    state: {
      ...state,
      targets: next.targets.length ? next.targets : state.targets,
      job: { status: "searching" as const, brief: next.brief, updatedAt: now },
      tasks: state.tasks.map((item) => (item.id === id ? next : item)),
      currentId: id,
    },
    task: next,
    error: null,
  }
}

export function cancelInquiryTask(state: InquiryState, id: string, now = new Date().toISOString()) {
  const hit = state.tasks.find((item) => item.id === id)
  if (!hit) return { state, error: "missing" as const }
  const next = pushRun({ ...hit, status: "cancelled", enabled: false, updatedAt: now }, "cancelled", "同事取消了这轮询单。", now)
  return {
    state: {
      ...state,
      job: state.currentId === id ? { status: "paused" as const, brief: next.brief, updatedAt: now } : state.job,
      tasks: state.tasks.map((item) => (item.id === id ? next : item)),
    },
    task: next,
    error: null,
  }
}

export function deleteInquiryTask(state: InquiryState, id: string) {
  const hit = state.tasks.find((item) => item.id === id)
  if (!hit) return { state, error: "missing" as const }
  const tasks = state.tasks.filter((item) => item.id !== id)
  return {
    state: {
      ...state,
      tasks,
      currentId: state.currentId === id ? tasks[0]?.id : state.currentId,
    },
    task: hit,
    error: null,
  }
}

export function buildTaskAssignMessage(task: InquiryTask) {
  const list = task.targets.map((item) => item.label).join("、")
  const extra = task.instruction ? `补充指令：${task.instruction}` : ""
  return [
    list ? `按这些真实需求去找厂商：${list}。` : "按同事写的指令去找真实厂商。",
    extra,
    `本轮最多找 ${task.quota || 8} 家带真实来源的厂商，到数即停，不够不要编。`,
    task.limitHours ? `本轮限时 ${task.limitHours} 小时，到点停止。` : "",
    "流程按 取条件 → 找来源 → 核实 → 起草稿。没有来源不要编。",
    "找到官网、可核验来源、联系方式或邮箱后只起草询单邮件。本站没有发信口，不要写已经发出。",
  ]
    .filter(Boolean)
    .join("")
}
