import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import type { HermesHealth } from "../cms/hermes"
import {
  CHANNEL_LABEL,
  ENERGY_LABEL,
  MAIL_STATUS_LABEL,
  MAIL_TRACK_LABEL,
  PROGRESS_LABEL,
  PROGRESS_TRACK,
  boardMetrics,
  caseTitle,
  usefulVisitNote,
  customerArchives,
  customerKey,
  factoryArchives,
  factoryName,
  filterHermesCases,
  formatInquiryRate,
  formatPace,
  isLiveCase,
  normalizeCase,
  stageFill,
  ticketNo,
  ticketsForCustomer,
  ticketsForFactory,
  type HermesCase,
  type HermesCoachImage,
  type HermesCoachTurn,
  type HermesEvent,
  type HermesMemory,
  type StaffCasePatch,
} from "../cms/hermesDesk"
import { emptyInquiry, type InquiryState } from "../cms/inquiryDesk"
import { withBase } from "../lib/asset"
import { DeskBoard } from "./DeskBoard"
import { InquiryPanel } from "./InquiryPanel"
import { TicketsPanel, TicketEditDialog } from "./TicketsPanel"
import { IconArchive, IconBack, IconClip, IconLock, IconMore, IconRefresh, IconSend } from "./icons"
import type { AdminAuth } from "./LeadsPanel"

type LinkView = "connecting" | "reconnecting" | "connected" | "disconnected"
export type DeskArea = "overview" | "desk" | "inquiry" | "archives"
type TicketView = "tickets" | "customers" | "factories"
type PendingImage = { key: string; mime: string; name: string; data: string; preview: string }
type BoardFocus =
  | { kind: "home" }
  | { kind: "ticket"; id: string }
  | { kind: "customer"; key: string }
  | { kind: "factory"; name: string }

const AGENT_NAME = "Linda"
const DESK_NAME = "询单工位"

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

const STATUS_LABEL: Record<LinkView, string> = {
  connecting: "连接待验收",
  reconnecting: "正在重新连接",
  connected: "正常连接",
  disconnected: "断开连接",
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false })
  } catch {
    return iso
  }
}

function deskEndpoint() {
  return withBase("api/hermes-desk")
}

function percent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

async function fileToPending(file: File): Promise<PendingImage | null> {
  if (!file.type.startsWith("image/")) return null
  const buffer = await file.arrayBuffer()
  if (buffer.byteLength > 1_600_000) return null
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return {
    key: `${file.name}-${file.size}-${Date.now()}`,
    mime: file.type,
    name: file.name.slice(0, 80),
    data: btoa(binary),
    preview: URL.createObjectURL(file),
  }
}

function AuthImage({ id, headers }: { id: string; headers: HeadersInit }) {
  const [src, setSrc] = useState("")
  useEffect(() => {
    let url = ""
    let dead = false
    void fetch(`${deskEndpoint()}?asset=${encodeURIComponent(id)}`, { headers })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob || dead) return
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
    return () => {
      dead = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [headers, id])
  if (!src) return <span className="hermes-grok__img-wait" aria-hidden="true" />
  return <img src={src} alt="" />
}

function MiniStages({ progress }: { progress: HermesCase["progress"] }) {
  return (
    <div className="hermes-mini-stages" aria-hidden="true">
      {PROGRESS_TRACK.map((step) => (
        <span key={step} title={PROGRESS_LABEL[step]}>
          <i style={{ width: percent(stageFill(progress, step)) }} />
        </span>
      ))}
    </div>
  )
}

function StageList({ progress, paused }: { progress: HermesCase["progress"]; paused?: boolean }) {
  return (
    <ol className={`hermes-stages${paused ? " is-paused" : ""}`}>
      {PROGRESS_TRACK.map((step) => {
        const fill = stageFill(progress, step)
        return (
          <li key={step} className={fill >= 1 ? "is-done" : fill > 0 ? "is-now" : ""}>
            <div>
              <span>{PROGRESS_LABEL[step]}</span>
              <b>{percent(fill)}</b>
            </div>
            <div className="hermes-rail__track">
              <i style={{ width: percent(fill) }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Fold({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className={`hermes-fold${open ? " is-open" : ""}`}>
      <button type="button" onClick={onToggle}>
        <span>{title}</span>
        <em>{open ? "收起" : "展开"}</em>
      </button>
      {open ? <div className="hermes-fold__body">{children}</div> : null}
    </section>
  )
}

function Meter({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="hermes-meter">
      <span>{label}</span>
      <strong>{hint}</strong>
      <div className="hermes-rail__track" aria-hidden="true">
        <i style={{ width: percent(value) }} />
      </div>
    </div>
  )
}

type DeskPayload = {
  cases?: HermesCase[]
  coach?: HermesCoachTurn[]
  events?: HermesEvent[]
  memory?: HermesMemory
  health?: HermesHealth | null
  hermesReady?: boolean
  attachable?: { id: string; name: string; org: string; note: string; at: string }[]
  board?: ReturnType<typeof boardMetrics>
  inquiry?: InquiryState
  reply?: string
  assignMessage?: string
  caseId?: string
  error?: string
}

export function HermesDesk({
  auth,
  area = "desk",
  archiveView,
  onNeedDesk,
  onExpandSide,
  visible = true,
}: {
  auth: AdminAuth
  area?: DeskArea
  archiveView?: TicketView
  onNeedDesk?: () => void
  onExpandSide?: () => void
  visible?: boolean
}) {
  const [cases, setCases] = useState<HermesCase[]>([])
  const [coach, setCoach] = useState<HermesCoachTurn[]>([])
  const [events, setEvents] = useState<HermesEvent[]>([])
  const [status, setStatus] = useState<LinkView>("connecting")
  const [healthDetail, setHealthDetail] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const [focus, setFocus] = useState<BoardFocus>({ kind: "home" })
  const [editTicketId, setEditTicketId] = useState<string | null>(null)
  const [mobileChat, setMobileChat] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [chatMenu, setChatMenu] = useState(false)
  const [inquiry, setInquiry] = useState<InquiryState>(emptyInquiry)
  const [inquiryBusy, setInquiryBusy] = useState(false)
  const [hermesReady, setHermesReady] = useState(false)
  const [pending, setPending] = useState<PendingImage[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [folds, setFolds] = useState<Record<string, boolean>>({
    stages: true,
    customer: true,
    factory: true,
    mail: true,
    related: true,
    behavior: false,
    time: false,
  })
  const logRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "X-Admin-User": auth.user,
      "X-Admin-Pass": auth.pass,
    }),
    [auth.user, auth.pass],
  )

  const hiddenIds = useRef(new Set<string>())

  const apply = useCallback((payload: DeskPayload, mode: "full" | "health" = "full") => {
    if (mode === "full" && Array.isArray(payload.cases)) {
      const next = payload.cases
        .map(normalizeCase)
        .filter((item) => !item.gone && !hiddenIds.current.has(item.id))
      setCases((prev) => (sameJson(prev, next) ? prev : next))
    }
    if (mode === "full" && Array.isArray(payload.coach)) setCoach((prev) => (sameJson(prev, payload.coach) ? prev : payload.coach!))
    if (mode === "full" && Array.isArray(payload.events)) setEvents((prev) => (sameJson(prev, payload.events) ? prev : payload.events!))
    if (mode === "full" && payload.inquiry) setInquiry((prev) => (sameJson(prev, payload.inquiry) ? prev : payload.inquiry!))
    if (typeof payload.hermesReady === "boolean") setHermesReady(payload.hermesReady)
    if (payload.health) {
      if (payload.health.status === "connected") {
        setStatus("connected")
        setHealthDetail(payload.health.detail || "")
      } else if (payload.hermesReady) {
        setStatus("connected")
        setHealthDetail(payload.health.detail || "备用线路仍可用")
      } else {
        setStatus("disconnected")
        setHealthDetail(payload.health.detail || "")
      }
    }
  }, [])

  const post = useCallback(
    async (body: Record<string, unknown>, mode: "full" | "health" = "full") => {
      const response = await fetch(deskEndpoint(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as DeskPayload
      if (!response.ok) throw new Error(payload.error === "hermes-only" ? `这项只能由 ${AGENT_NAME} 改` : payload.error || `接口返回 ${response.status}`)
      apply(payload, mode)
      return payload
    },
    [apply, headers],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(deskEndpoint(), { headers })
      if (!response.ok) throw new Error(`接口返回 ${response.status}`)
      apply((await response.json()) as DeskPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败")
    } finally {
      setLoading(false)
    }
  }, [apply, headers])

  const probe = useCallback(async () => {
    setStatus((current) => (current === "connected" || current === "disconnected" ? "reconnecting" : "connecting"))
    try {
      await post({ action: "health" }, "health")
    } catch {
      setStatus((current) => (current === "connected" ? "connected" : "disconnected"))
      setHealthDetail((current) => current || "探测失败")
    }
  }, [post])

  useEffect(() => {
    void load().then(() => void probe())
  }, [load, probe])

  useEffect(() => {
    if (!visible) return
    void load()
  }, [visible, load])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (status !== "connected") void probe()
    }, 60000)
    return () => window.clearInterval(timer)
  }, [probe, status])

  const deleteCases = useCallback(
    async (ids: string[]) => {
      const wanted = ids.filter((id) => id.startsWith("case-"))
      if (!wanted.length) return
      const liveIds = cases.filter((item) => !item.gone).map((item) => item.id)
      const clear = liveIds.length > 0 && liveIds.every((id) => wanted.includes(id))
      for (const id of clear ? liveIds : wanted) hiddenIds.current.add(id)
      setError("")
      const snapshot = cases
      setCases(snapshot.filter((item) => !hiddenIds.current.has(item.id)))
      if (focus.kind === "ticket" && wanted.includes(focus.id)) {
        setFocus({ kind: "home" })
        setArchiveOpen(false)
        setMobileChat(false)
      }
      try {
        const payload = await post({ action: "cases", op: clear ? "clear" : "delete", ids: wanted })
        const leftover = (payload.cases || []).filter((item) => !item.gone && !hiddenIds.current.has(item.id))
        if (clear) {
          for (const item of leftover) hiddenIds.current.add(item.id)
          apply({ ...payload, cases: [] })
        } else if (leftover.some((item) => wanted.includes(item.id))) {
          setError("工单还在储存里，这次没删干净。")
        }
      } catch (err) {
        for (const id of wanted) hiddenIds.current.delete(id)
        setCases(snapshot)
        setError(err instanceof Error ? err.message : "删除失败")
        throw err
      }
    },
    [apply, cases, focus, post],
  )

  const updateCase = useCallback(
    async (id: string, patch: StaffCasePatch) => {
      setError("")
      try {
        await post({ action: "cases", op: "update", id, patch })
      } catch (err) {
        setError(err instanceof Error ? err.message : "保存失败")
      }
    },
    [post],
  )

  const batchUpdateCases = useCallback(
    async (ids: string[], patch: StaffCasePatch) => {
      setError("")
      try {
        await post({ action: "cases", op: "batch", ids, patch })
      } catch (err) {
        setError(err instanceof Error ? err.message : "批量编辑失败")
        throw err
      }
    },
    [post],
  )

  const clearCoach = useCallback(async () => {
    if (!coach.length) return
    if (!window.confirm("清空询单工位对话记录？工单和询单设定不会删。")) return
    setError("")
    try {
      await post({ action: "coach-clear" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空失败")
    }
  }, [coach.length, post])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [coach, sending])

  useEffect(
    () => () => {
      for (const item of pending) URL.revokeObjectURL(item.preview)
    },
    [pending],
  )

  const allLive = useMemo(() => filterHermesCases(cases, { origin: "live" }).map(normalizeCase), [cases])
  const selected = focus.kind === "ticket" ? allLive.find((item) => item.id === focus.id) || null : null
  const customerFile =
    focus.kind === "customer" ? customerArchives(allLive).find((item) => customerKey(item) === focus.key) || null : null
  const factoryFile = focus.kind === "factory" ? factoryArchives(allLive).find((item) => item.name === focus.name) || null : null
  const customerTickets = useMemo(
    () => (customerFile ? ticketsForCustomer(allLive, customerKey(customerFile)) : []),
    [allLive, customerFile],
  )
  const factoryTickets = useMemo(
    () => (factoryFile ? ticketsForFactory(allLive, factoryFile.name) : []),
    [allLive, factoryFile],
  )
  const timelineCaseId = selected?.id || customerFile?.id || factoryFile?.latest.id
  const timeline = events.filter((item) => !timelineCaseId || !item.caseId || item.caseId === timelineCaseId).slice(-12).reverse()

  const compactBoard = () => typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches
  const openFolds = (extraOpen: boolean) =>
    setFolds({
      stages: true,
      customer: extraOpen,
      factory: extraOpen,
      mail: extraOpen,
      related: extraOpen,
      behavior: false,
      time: false,
    })
  const toggleFold = (key: string) => setFolds((current) => ({ ...current, [key]: !current[key] }))
  const goDesk = () => onNeedDesk?.()
  const goBoard = (next: BoardFocus, opts?: { archive?: boolean; chat?: boolean }) => {
    const compact = compactBoard()
    setFocus(next)
    openFolds(next.kind === "home" ? true : !compact)
    setChatMenu(false)
    if (next.kind === "home") {
      setArchiveOpen(false)
      if (compact) setMobileChat(false)
      return
    }
    const wantArchive = opts?.archive ?? next.kind !== "ticket"
    const wantChat = opts?.chat ?? (compact && next.kind === "ticket" && !wantArchive)
    setArchiveOpen(wantArchive)
    if (compact) setMobileChat(wantChat)
  }

  const runSearch = (event?: FormEvent) => {
    event?.preventDefault()
    const q = query.trim()
    if (!q) {
      goBoard({ kind: "home" })
      return
    }
    const hits = filterHermesCases(cases, { origin: "live", query: q }).map(normalizeCase)
    if (hits.length === 1) {
      goDesk()
      goBoard({ kind: "ticket", id: hits[0]!.id }, { chat: compactBoard(), archive: false })
      return
    }
    goBoard({ kind: "home" })
  }

  const ticketFollow = (item: HermesCase) =>
    item.owner === "human" ? "人工跟进中" : item.following ? `${AGENT_NAME} 跟进中` : "尚未跟进"

  const ticketMail = (item: HermesCase) => {
    const status = MAIL_STATUS_LABEL[item.mailStatus || "none"]
    const follow = item.mailFollowUp ? "有跟单" : "无跟单"
    return `${status} · ${follow}`
  }

  const addFiles = async (files: FileList | File[]) => {
    const next: PendingImage[] = []
    for (const file of [...files]) {
      if (pending.length + next.length >= 3) break
      const item = await fileToPending(file)
      if (item) next.push(item)
    }
    if (next.length) setPending((current) => [...current, ...next].slice(0, 3))
  }

  const sendCoach = async () => {
    const message = input.trim()
    if ((!message && !pending.length) || sending) return
    setSending(true)
    setError("")
    setInput("")
    const images = pending.map(({ mime, name, data }) => ({ mime, name, data }))
    setPending((current) => {
      for (const item of current) URL.revokeObjectURL(item.preview)
      return []
    })
    try {
      await post({ action: "coach", message, images })
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败")
      setInput(message)
    } finally {
      setSending(false)
    }
  }

  const profile = selected || customerFile || factoryFile?.latest || null
  const inquiryMeter = profile?.inquiryCount ? Math.min(1, profile.inquiryCount / 8) : 0
  const rateHint = profile ? formatInquiryRate(profile) : ""
  const rateMeter = profile?.inquiryCount
    ? Math.min(1, (profile.inquiryCount || 0) / Math.max(1, (Date.now() - Date.parse(profile.at)) / 86400000) / 4)
    : 0
  const replyMeter = profile?.replyPaceMin != null ? Math.max(0.12, 1 - Math.min(profile.replyPaceMin, 240) / 240) : 0
  const inquirePaceMeter = profile?.inquiryPaceMin != null ? Math.max(0.12, 1 - Math.min(profile.inquiryPaceMin, 7 * 24 * 60) / (7 * 24 * 60)) : 0
  const mailReplyMeter = profile?.emailReplyHours != null ? Math.max(0.12, 1 - Math.min(profile.emailReplyHours, 72) / 72) : 0

  const ticketRow = (item: HermesCase, lines: string[], kicker?: string) => (
    <button type="button" className="hermes-ticket" onClick={() => goBoard({ kind: "ticket", id: item.id })}>
      <div className="hermes-ticket__body">
        <em>{kicker || `工单 ${ticketNo(item)}`}</em>
        <strong>{item.name}</strong>
        <span className="hermes-ticket__no">{ticketNo(item)}</span>
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
        <MiniStages progress={item.progress} />
      </div>
      <b aria-hidden="true">›</b>
    </button>
  )

  const fileFacts = (item: HermesCase, extra: { label: string; value: string }[] = []) => (
    <dl className="hermes-file">
      {[
        { label: "称呼", value: item.name },
        { label: "公司", value: item.org || "尚无" },
        { label: "联系方式", value: item.contact || "尚无" },
        { label: "地区", value: item.place || "尚无" },
        { label: "意向", value: ENERGY_LABEL[item.energy] },
        { label: "渠道", value: CHANNEL_LABEL[item.lastChannel || "unset"] },
        { label: "线索", value: item.note || "尚无" },
        { label: "下一步", value: item.nextAction || "尚无" },
        ...extra,
      ].map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )

  const mailBlock = (item: HermesCase) => (
    <>
      <ul className="hermes-mail">
        <li className={item.mailStatus !== "none" ? "is-on" : ""}>
          {MAIL_STATUS_LABEL[item.mailStatus || "none"]}
          {item.mailSentAt ? ` · ${formatTime(item.mailSentAt)}` : ""}
        </li>
        <li className={item.mailFollowUp ? "is-on" : ""}>{item.mailFollowUp ? "有跟单" : "无跟单"}</li>
        <li className={item.mailTracking && item.mailTracking !== "none" ? "is-on" : ""}>
          {MAIL_TRACK_LABEL[item.mailTracking || "none"]}
        </li>
      </ul>
      <p className="hermes-sum">{item.mailSummary || `还没有客户回邮摘要。${AGENT_NAME} 读到真邮件后再写。`}</p>
      <p className="hermes-sum">发出邮件由询单工位起草，使用 Hermes 自己的邮箱身份。没有挂上发出信箱时只入队，不会写成已发送。</p>
    </>
  )

  const behaviorBlock = (item: HermesCase) => (
    <div className="hermes-meters">
      <Meter label="询单次数" value={inquiryMeter} hint={item.inquiryCount ? `${item.inquiryCount} 次` : "尚无"} />
      <Meter label="询单速度" value={rateMeter} hint={rateHint || "尚无"} />
      <Meter label="询单间隔" value={inquirePaceMeter} hint={formatPace(item.inquiryPaceMin) || "尚无"} />
      <Meter label="回复速度" value={replyMeter} hint={formatPace(item.replyPaceMin) || "尚无"} />
      <Meter label="回邮用时" value={mailReplyMeter} hint={item.emailReplyHours != null ? `${item.emailReplyHours} 小时` : "尚无"} />
    </div>
  )

  const followCard = selected ? (
    <aside className="karm-follow">
      <header>
        <IconArchive />
        <strong>本次跟进摘要</strong>
      </header>
      <dl>
        <div>
          <dt>关注问题</dt>
          <dd>{usefulVisitNote(selected.note || "") || "尚无"}</dd>
        </div>
        <div>
          <dt>下一步</dt>
          <dd>{selected.nextAction || "尚无"}</dd>
        </div>
        <div>
          <dt>邮件状态</dt>
          <dd>
            {selected.mailStatus && selected.mailStatus !== "none"
              ? MAIL_STATUS_LABEL[selected.mailStatus]
              : "草稿，尚未发送"}
          </dd>
        </div>
      </dl>
    </aside>
  ) : null

  const lastLindaId = [...coach].reverse().find((turn) => turn.role !== "staff")?.id

  const inquiryPanel = (
    <InquiryPanel
      inquiry={inquiry}
      locked={inquiryBusy}
      hermesReady={hermesReady}
      ticketNoOf={(id) => {
        const rec = cases.find((item) => item.id === id)
        return rec ? ticketNo(rec) : ""
      }}
      onTask={async (op, body) => {
        const lock = op === "create" || op === "delete"
        setError("")
        if (lock) setInquiryBusy(true)
        try {
          return await post({ action: "task", op, ...(body || {}) })
        } catch (err) {
          setError(err instanceof Error ? err.message : "询单任务失败")
          throw err
        } finally {
          if (lock) setInquiryBusy(false)
        }
      }}
      onStart={async (id) => {
        setInquiryBusy(true)
        setError("")
        try {
          const payload = await post({ action: "task", op: "start", id })
          const message = payload.assignMessage || ""
          if (message) {
            goDesk()
            if (compactBoard()) setMobileChat(true)
            await post({ action: "coach", message })
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "安排失败")
          throw err
        } finally {
          setInquiryBusy(false)
        }
      }}
      onFile={async (findingId) => {
        setError("")
        try {
          const payload = await post({ action: "file", findingId })
          const filed = payload.inquiry?.findings?.find((item) => item.id === findingId)
          if (filed?.caseId) {
            goDesk()
            goBoard({ kind: "ticket", id: filed.caseId }, { archive: false, chat: compactBoard() })
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "建档失败")
        }
      }}
      onOpenTicket={(caseId) => {
        goDesk()
        goBoard({ kind: "ticket", id: caseId }, { archive: false, chat: compactBoard() })
      }}
    />
  )

  const ticketsPanel = (
    <TicketsPanel
      cases={cases}
      loading={loading}
      query={query}
      onQueryChange={setQuery}
      onSearch={runSearch}
      initialView={area === "archives" ? archiveView : "tickets"}
      focusId={focus.kind === "ticket" ? focus.id : undefined}
      onOpenTicket={(id) => {
        goDesk()
        goBoard({ kind: "ticket", id }, { archive: false, chat: compactBoard() })
      }}
      onOpenCustomer={(key) => goBoard({ kind: "customer", key }, { archive: true })}
      onOpenFactory={(name) => goBoard({ kind: "factory", name }, { archive: true })}
      onUpdate={updateCase}
      onDelete={deleteCases}
      onBatchUpdate={batchUpdateCases}
    />
  )

  const archiveBody = selected ? (
    <section className="hermes-detail">
      <div className="hermes-detail__bar">
        <button type="button" className="hermes-back" onClick={() => setArchiveOpen(false)}>
          关闭档案
        </button>
        <span className="hermes-detail__ops">
          <button type="button" onClick={() => setEditTicketId(selected.id)}>
            编辑
          </button>
          <button
            type="button"
            className="is-danger"
            onClick={() => {
              if (!window.confirm("删除这张工单？删除后无法恢复。")) return
              void deleteCases([selected.id]).then(() => setArchiveOpen(false))
            }}
          >
            删除
          </button>
        </span>
      </div>
      <header className="hermes-panel__who">
        <em>工单 {ticketNo(selected)}</em>
        <strong>{caseTitle(selected)}</strong>
        <span>
          {ticketFollow(selected)}
          {isLiveCase(selected) ? " · 真实对话" : ""}
        </span>
      </header>
      <Fold title="环节进度" open={folds.stages} onToggle={() => toggleFold("stages")}>
        <StageList progress={selected.progress} paused={selected.progress === "hold"} />
      </Fold>
      <Fold title="客户档案" open={folds.customer} onToggle={() => toggleFold("customer")}>
        {fileFacts(selected, [{ label: "工单号", value: ticketNo(selected) }])}
        <button type="button" className="hermes-link" onClick={() => goBoard({ kind: "customer", key: customerKey(selected) }, { archive: true })}>
          打开这份客户档案
        </button>
      </Fold>
      <Fold title="工厂档案" open={folds.factory} onToggle={() => toggleFold("factory")}>
        {factoryName(selected) ? (
          <>
            <dl className="hermes-file">
              <div>
                <dt>工厂</dt>
                <dd>{factoryName(selected)}</dd>
              </div>
              <div>
                <dt>地区</dt>
                <dd>{selected.place || "尚无"}</dd>
              </div>
              <div>
                <dt>关联工单</dt>
                <dd>{ticketsForFactory(allLive, factoryName(selected)).length} 张</dd>
              </div>
            </dl>
            <button type="button" className="hermes-link" onClick={() => goBoard({ kind: "factory", name: factoryName(selected) }, { archive: true })}>
              打开这份工厂档案
            </button>
          </>
        ) : (
          <p className="hermes-grok__empty">这家工厂还没建档。有真实厂名后，{AGENT_NAME} 会写进来。</p>
        )}
      </Fold>
      <Fold title="邮件" open={folds.mail} onToggle={() => toggleFold("mail")}>
        {mailBlock(selected)}
      </Fold>
      <Fold title="客户行为" open={folds.behavior} onToggle={() => toggleFold("behavior")}>
        {behaviorBlock(selected)}
      </Fold>
      <Fold title="时间线" open={folds.time} onToggle={() => toggleFold("time")}>
        {timeline.length === 0 ? <p className="hermes-grok__empty">还没有事件。</p> : null}
        <ol className="hermes-grok__time-list">
          {timeline.map((item) => (
            <li key={item.id}>
              <time dateTime={item.at}>{formatTime(item.at)}</time>
              <span>{item.text}</span>
            </li>
          ))}
        </ol>
      </Fold>
    </section>
  ) : customerFile ? (
    <section className="hermes-detail">
      <button type="button" className="hermes-back" onClick={() => setArchiveOpen(false)}>
        关闭档案
      </button>
      <header className="hermes-panel__who">
        <em>客户档案</em>
        <strong>{customerFile.name}</strong>
        <span>
          {ticketFollow(customerFile)} · {customerFile.place || "地区尚无"}
        </span>
      </header>
      <Fold title="环节进度" open={folds.stages} onToggle={() => toggleFold("stages")}>
        <StageList progress={customerFile.progress} paused={customerFile.progress === "hold"} />
      </Fold>
      <Fold title="档案信息" open={folds.customer} onToggle={() => toggleFold("customer")}>
        {fileFacts(customerFile, [
          { label: "工厂", value: factoryName(customerFile) || "尚未建档" },
          { label: "工单", value: customerTickets.map(ticketNo).join(" · ") || "尚无" },
        ])}
      </Fold>
      <Fold title="关联工单" open={folds.related} onToggle={() => toggleFold("related")}>
        <ul className="hermes-tickets__list">
          {customerTickets.map((item) => (
            <li key={item.id}>
              {ticketRow(item, [`${ticketFollow(item)} · ${PROGRESS_LABEL[item.progress]}`, ticketMail(item)])}
            </li>
          ))}
        </ul>
      </Fold>
      {factoryName(customerFile) ? (
        <Fold title="关联工厂" open={folds.factory} onToggle={() => toggleFold("factory")}>
          <button type="button" className="hermes-link" onClick={() => goBoard({ kind: "factory", name: factoryName(customerFile) }, { archive: true })}>
            {factoryName(customerFile)}
          </button>
        </Fold>
      ) : null}
      <Fold title="邮件" open={folds.mail} onToggle={() => toggleFold("mail")}>
        {mailBlock(customerFile)}
      </Fold>
      <Fold title="客户行为" open={folds.behavior} onToggle={() => toggleFold("behavior")}>
        {behaviorBlock(customerFile)}
      </Fold>
    </section>
  ) : factoryFile ? (
    <section className="hermes-detail">
      <button type="button" className="hermes-back" onClick={() => setArchiveOpen(false)}>
        关闭档案
      </button>
      <header className="hermes-panel__who">
        <em>工厂档案</em>
        <strong>{factoryFile.name}</strong>
        <span>
          {factoryFile.count} 张关联工单 · {PROGRESS_LABEL[factoryFile.latest.progress]}
        </span>
      </header>
      <Fold title="环节进度" open={folds.stages} onToggle={() => toggleFold("stages")}>
        <StageList progress={factoryFile.latest.progress} paused={factoryFile.latest.progress === "hold"} />
      </Fold>
      <Fold title="档案信息" open={folds.factory} onToggle={() => toggleFold("factory")}>
        <dl className="hermes-file">
          <div>
            <dt>工厂</dt>
            <dd>{factoryFile.name}</dd>
          </div>
          <div>
            <dt>地区</dt>
            <dd>{factoryFile.latest.place || "尚无"}</dd>
          </div>
          <div>
            <dt>关联工单</dt>
            <dd>{factoryFile.count} 张</dd>
          </div>
          <div>
            <dt>最新客户</dt>
            <dd>{factoryFile.latest.name}</dd>
          </div>
        </dl>
      </Fold>
      <Fold title="关联工单" open={folds.related} onToggle={() => toggleFold("related")}>
        <ul className="hermes-tickets__list">
          {factoryTickets.map((item) => (
            <li key={item.id}>
              {ticketRow(item, [`${ticketFollow(item)} · ${PROGRESS_LABEL[item.progress]}`, item.place || "地区尚无"])}
            </li>
          ))}
        </ul>
      </Fold>
    </section>
  ) : (
    <section className="hermes-detail">
      <button type="button" className="hermes-back" onClick={() => setArchiveOpen(false)}>
        关闭档案
      </button>
      <p className="hermes-grok__empty">先在左侧点开一张工单或一份档案。</p>
    </section>
  )

  const crumb =
    area === "overview" ? "总览" : area === "inquiry" ? "询单任务" : area === "archives" ? "客户与工厂" : "询单工位 / 工单档案"

  const chatTitle = selected ? caseTitle(selected) : customerFile ? customerFile.name : factoryFile ? factoryFile.name : DESK_NAME
  const chatId = selected ? ticketNo(selected) : ""
  const chatIdentity = `${DESK_NAME} · ${AGENT_NAME}`

  return (
    <div className={`hermes-grok hermes-apple hermes-karmenai hermes-karmenai--${area}${mobileChat ? " is-mobile-chat" : ""}${archiveOpen ? " is-archive" : ""}`}>
      <header className="karm-chrome">
        <p className="karm-chrome__crumb">{crumb}</p>
        <div className="karm-chrome__tools">
          {onExpandSide ? (
            <button type="button" className="hermes-grok__ghost" onClick={onExpandSide}>
              展开菜单
            </button>
          ) : null}
          <button
            type="button"
            className={`hermes-grok__status hermes-grok__status--${status}`}
            title={healthDetail || STATUS_LABEL[status]}
            onClick={() => void probe()}
          >
            <i />
            <span className="hermes-grok__status-label">{STATUS_LABEL[status]}</span>
          </button>
        </div>
      </header>

      {error ? <p className="hermes-grok__error">{error}</p> : null}

      <div className={`hermes-grok__body hermes-grok__body--${area}${mobileChat ? " is-mobile-chat" : ""}`}>
        {area === "overview" ? (
          <div className="karm-seat-col">
            <p className="karm-seat-bar">
              总览、工单、询单和档案都是同一个询单工位。
              <button type="button" onClick={() => { goDesk(); if (compactBoard()) setMobileChat(true) }}>
                打开对话
              </button>
            </p>
            <DeskBoard cases={allLive} events={events} inquiry={inquiry} coachTurns={coach.length} />
          </div>
        ) : null}

        {area === "inquiry" ? (
          <div className="karm-seat-col">
            <p className="karm-seat-bar">
              询单任务交给同一询单工位执行，不是前台高级顾问。
              <button type="button" onClick={() => { if (compactBoard()) setMobileChat(true); else goDesk() }}>
                打开对话
              </button>
            </p>
            {inquiryPanel}
          </div>
        ) : null}

        {area === "desk" || area === "archives" ? <aside className="hermes-panel">{ticketsPanel}</aside> : null}

        <section
          className={`hermes-grok__chat guide-desk${dragOver ? " is-drop" : ""}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            void addFiles(event.dataTransfer.files)
          }}
        >
          <header className="guide-desk__head karm-chat-head">
            <div className="karm-chat-head__main">
              {mobileChat ? (
                <button
                  type="button"
                  className="karm-icon-btn"
                  aria-label="返回"
                  onClick={() => {
                    setMobileChat(false)
                    setArchiveOpen(false)
                  }}
                >
                  <IconBack />
                </button>
              ) : null}
              <div className="karm-chat-head__copy">
                <p className="guide-desk__title">{chatTitle}</p>
                <p className="guide-desk__status">
                  {chatId ? <span className="karm-chat-head__id">{chatId}</span> : null}
                  <span>
                    {selected || customerFile || factoryFile ? chatIdentity : "后台同事席 · 工单和询单都在这里指挥"}
                  </span>
                </p>
              </div>
            </div>
            <div className="karm-chat-head__ops">
              <button
                type="button"
                className="karm-ghost"
                onClick={() => {
                  if (selected || customerFile || factoryFile) setArchiveOpen(true)
                  else setArchiveOpen(true)
                }}
              >
                <IconArchive />
                <span>查看档案</span>
              </button>
              <button type="button" className="karm-icon-btn" aria-label="更多" onClick={() => setChatMenu((open) => !open)}>
                <IconMore />
              </button>
              {chatMenu ? (
                <div className="karm-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setChatMenu(false)
                      void load()
                    }}
                  >
                    刷新
                  </button>
                  {coach.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        setChatMenu(false)
                        void clearCoach()
                      }}
                    >
                      清空对话
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>
          <div className="karm-chat-sub">
            <p>
              <IconLock />
              {selected ? `仅此客户档案 · ${DESK_NAME}` : "后台同事席 · 不是前台高级顾问"}
            </p>
            <div>
              <button type="button" onClick={() => void load()} disabled={loading}>
                <IconRefresh />
                {loading ? "读取中" : "刷新"}
              </button>
              {coach.length ? (
                <button type="button" onClick={() => void clearCoach()}>
                  清空对话
                </button>
              ) : null}
            </div>
          </div>
          <div className="hermes-grok__log guide-desk__log" ref={logRef}>
            {coach.length === 0 && !sending ? (
              <div className="guide-desk__hello">
                <p>
                  这是后台{DESK_NAME}，不是前台高级顾问席。直接指挥查工单、看全部客户、起草邮件或处理附件。询单条件会写进同一席。
                </p>
              </div>
            ) : null}
            {coach.map((turn) => (
              <article key={turn.id} className={`guide-desk__row guide-desk__row--${turn.role}`}>
                {turn.role !== "staff" ? (
                  <span className="guide-desk__avatar guide-desk__avatar--sm karm-avatar-l" aria-hidden="true">
                    L
                  </span>
                ) : (
                  <span className="guide-desk__avatar guide-desk__avatar--sm karm-avatar-staff" aria-hidden="true" />
                )}
                <div className={`guide-desk__bubble guide-desk__bubble--${turn.role}`}>
                  {turn.role !== "staff" ? (
                    <p className="karm-bubble-name">{chatIdentity}</p>
                  ) : null}
                  {turn.images?.length ? (
                    <div className="hermes-grok__thumbs">
                      {turn.images.map((image: HermesCoachImage) => (
                        <AuthImage key={image.id} id={image.id} headers={headers} />
                      ))}
                    </div>
                  ) : null}
                  <p>{turn.content}</p>
                  {turn.id === lastLindaId ? followCard : null}
                </div>
              </article>
            ))}
            {sending ? (
              <article className="guide-desk__row guide-desk__row--hermes" aria-live="polite">
                <span className="guide-desk__avatar guide-desk__avatar--sm karm-avatar-l" aria-hidden="true">
                  L
                </span>
                <p className="guide-desk__bubble guide-desk__bubble--hermes guide-desk__typing">
                  <span />
                  <span />
                  <span />
                </p>
              </article>
            ) : null}
          </div>
          <form
            className="hermes-gpt"
            onSubmit={(event) => {
              event.preventDefault()
              void sendCoach()
            }}
          >
            {pending.length ? (
              <ul className="hermes-gpt__pending">
                {pending.map((item) => (
                  <li key={item.key}>
                    <img src={item.preview} alt={item.name} />
                    <button
                      type="button"
                      aria-label="去掉这张图"
                      onClick={() =>
                        setPending((current) => {
                          const hit = current.find((row) => row.key === item.key)
                          if (hit) URL.revokeObjectURL(hit.preview)
                          return current.filter((row) => row.key !== item.key)
                        })
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="hermes-gpt__box">
              <button type="button" className="hermes-gpt__plus" onClick={() => fileRef.current?.click()} aria-label="添加图片">
                <IconClip />
              </button>
              <label className="sr-only" htmlFor="hermes-grok-input">
                给询单工位的指令
              </label>
              <textarea
                id="hermes-grok-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPaste={(event) => {
                  const files = [...event.clipboardData.files]
                  if (files.some((file) => file.type.startsWith("image/"))) {
                    event.preventDefault()
                    void addFiles(files)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void sendCoach()
                  }
                }}
                placeholder="给询单工位发指令…"
                rows={1}
                maxLength={2000}
              />
              <button type="submit" className="karm-send" disabled={(!input.trim() && !pending.length) || sending} aria-label="发送">
                <IconSend />
              </button>
            </div>
            <p className="karm-gpt-hint">可添加图片或文件</p>
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={(event) => {
                if (event.target.files) void addFiles(event.target.files)
                event.target.value = ""
              }}
            />
          </form>
        </section>

        {archiveOpen ? (
          <div className="karm-drawer" role="dialog" aria-label="档案">
            <div className="karm-drawer__card">{archiveBody}</div>
          </div>
        ) : null}

        {editTicketId && selected && editTicketId === selected.id ? (
          <TicketEditDialog
            item={selected}
            onClose={() => setEditTicketId(null)}
            onSave={async (patch) => {
              await updateCase(selected.id, patch)
              setEditTicketId(null)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
