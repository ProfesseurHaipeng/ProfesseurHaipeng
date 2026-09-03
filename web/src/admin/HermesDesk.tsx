import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { HermesHealth } from "../cms/hermes"
import {
  CHANNEL_LABEL,
  ENERGY_LABEL,
  MAIL_STATUS_LABEL,
  MAIL_TRACK_LABEL,
  PROGRESS_LABEL,
  PROGRESS_TRACK,
  boardMetrics,
  customerArchives,
  customerKey,
  emptyMemory,
  factoryArchives,
  factoryName,
  filterHermesCases,
  formatInquiryRate,
  formatPace,
  isLiveCase,
  normalizeCase,
  stageFill,
  ticketsForCustomer,
  ticketsForFactory,
  type HermesCase,
  type HermesCoachImage,
  type HermesCoachTurn,
  type HermesDeskLink,
  type HermesEvent,
  type HermesMemory,
} from "../cms/hermesDesk"
import { withBase } from "../lib/asset"
import type { AdminAuth } from "./LeadsPanel"

type LinkView = "connecting" | "connected" | "disconnected"
type MobilePane = "chat" | "board"
type PendingImage = { key: string; mime: string; name: string; data: string; preview: string }
type BoardFocus =
  | { kind: "home" }
  | { kind: "ticket"; id: string }
  | { kind: "customer"; key: string }
  | { kind: "factory"; name: string }

const AGENT_NAME = "Karmenai"

const STATUS_LABEL: Record<LinkView, string> = {
  connecting: "正在连接",
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
  link?: HermesDeskLink
  health?: HermesHealth | null
  board?: ReturnType<typeof boardMetrics>
  reply?: string
  error?: string
}

export function HermesDesk({ auth }: { auth: AdminAuth }) {
  const [cases, setCases] = useState<HermesCase[]>([])
  const [coach, setCoach] = useState<HermesCoachTurn[]>([])
  const [events, setEvents] = useState<HermesEvent[]>([])
  const [memory, setMemory] = useState<HermesMemory>(emptyMemory())
  const [link, setLink] = useState<HermesDeskLink>({ configured: false, model: "", host: "" })
  const [status, setStatus] = useState<LinkView>("connecting")
  const [healthAt, setHealthAt] = useState("")
  const [healthDetail, setHealthDetail] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const [focus, setFocus] = useState<BoardFocus>({ kind: "home" })
  const [pane, setPane] = useState<MobilePane>("chat")
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

  const apply = useCallback((payload: DeskPayload) => {
    if (Array.isArray(payload.cases)) setCases(payload.cases.map(normalizeCase))
    if (Array.isArray(payload.coach)) setCoach(payload.coach)
    if (Array.isArray(payload.events)) setEvents(payload.events)
    if (payload.memory) setMemory(payload.memory)
    if (payload.link) setLink(payload.link)
    if (payload.health) {
      setStatus(payload.health.status === "connected" ? "connected" : "disconnected")
      setHealthAt(payload.health.checkedAt || "")
      setHealthDetail(payload.health.detail || "")
    }
  }, [])

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const response = await fetch(deskEndpoint(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as DeskPayload
      if (!response.ok) throw new Error(payload.error === "hermes-only" ? `这项只能由 ${AGENT_NAME} 改` : payload.error || `接口返回 ${response.status}`)
      apply(payload)
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
    setStatus((current) => (current === "connected" ? current : "connecting"))
    try {
      await post({ action: "health" })
    } catch {
      setStatus("disconnected")
      setHealthDetail("探测失败")
    }
  }, [post])

  useEffect(() => {
    void load().then(() => void probe())
  }, [load, probe])

  useEffect(() => {
    const timer = window.setInterval(() => void probe(), 20000)
    return () => window.clearInterval(timer)
  }, [probe])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [coach, sending])

  useEffect(
    () => () => {
      for (const item of pending) URL.revokeObjectURL(item.preview)
    },
    [pending],
  )

  const visible = filterHermesCases(cases, { origin: "live", query }).map(normalizeCase)
  const allLive = filterHermesCases(cases, { origin: "live" }).map(normalizeCase)
  const selected = focus.kind === "ticket" ? allLive.find((item) => item.id === focus.id) || null : null
  const customerFile =
    focus.kind === "customer" ? customerArchives(allLive).find((item) => customerKey(item) === focus.key) || null : null
  const factoryFile = focus.kind === "factory" ? factoryArchives(allLive).find((item) => item.name === focus.name) || null : null
  const customers = customerArchives(visible)
  const factories = factoryArchives(visible)
  const customerTickets = customerFile ? ticketsForCustomer(allLive, customerKey(customerFile)) : []
  const factoryTickets = factoryFile ? ticketsForFactory(allLive, factoryFile.name) : []
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
  const goBoard = (next: BoardFocus) => {
    const compact = compactBoard()
    setFocus(next)
    openFolds(next.kind === "home" ? true : !compact)
    if (compact && next.kind !== "home") setPane("board")
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
        {kicker ? <em>{kicker}</em> : null}
        <strong>{item.name}</strong>
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

  return (
    <div className="hermes-grok hermes-apple">
      <div className={`hermes-scan${status === "connecting" ? " is-on" : ""}`} aria-hidden="true" />
      <header className="hermes-grok__top">
        <div className="hermes-grok__brand">
          <strong>{AGENT_NAME}</strong>
          <span>工单与档案只读 · 同事只通过对话指挥</span>
        </div>
        <p className={`hermes-grok__status hermes-grok__status--${status}`} title={healthDetail || undefined}>
          <i />
          {STATUS_LABEL[status]}
          {link.model && status === "connected" ? <em>{link.model}</em> : null}
          {status === "disconnected" && !link.configured ? <em>未配置网关</em> : null}
        </p>
        <div className="hermes-grok__tools">
          <button type="button" className="hermes-grok__ghost" onClick={() => void probe()}>
            探测连接
          </button>
          <button type="button" className="hermes-grok__ghost" onClick={() => void load()} disabled={loading}>
            {loading ? "读取中" : "刷新"}
          </button>
        </div>
      </header>

      <nav className="hermes-grok__tabs" aria-label="工作台分区">
        <button type="button" className={pane === "chat" ? "is-on" : ""} onClick={() => setPane("chat")}>
          对话
        </button>
        <button type="button" className={pane === "board" ? "is-on" : ""} onClick={() => setPane("board")}>
          单子
        </button>
      </nav>

      {error ? <p className="hermes-grok__error">{error}</p> : null}

      <div className={`hermes-grok__body hermes-grok__body--${pane}`}>
        <section
          className={`hermes-grok__chat${dragOver ? " is-drop" : ""}`}
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
          <div className="hermes-grok__log" ref={logRef}>
            {coach.length === 0 && !sending ? (
              <div className="hermes-grok__hello">
                <h2>{AGENT_NAME}</h2>
                <p>进度、接管、邮件和客户行为都由我改。你只要在这里说话，也可以发图。</p>
              </div>
            ) : null}
            {coach.map((turn) => (
              <article key={turn.id} className={`hermes-grok__bubble hermes-grok__bubble--${turn.role}`}>
                {turn.images?.length ? (
                  <div className="hermes-grok__thumbs">
                    {turn.images.map((image: HermesCoachImage) => (
                      <AuthImage key={image.id} id={image.id} headers={headers} />
                    ))}
                  </div>
                ) : null}
                <p>{turn.content}</p>
                <time dateTime={turn.at}>
                  {turn.role === "staff" ? "你" : AGENT_NAME} · {formatTime(turn.at)}
                </time>
              </article>
            ))}
            {sending ? (
              <div className="hermes-load" aria-live="polite">
                <span />
                <span />
                <span />
                {AGENT_NAME} 正在看档案
              </div>
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
                +
              </button>
              <label className="sr-only" htmlFor="hermes-grok-input">
                给 {AGENT_NAME} 的指令
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
                placeholder={`给 ${AGENT_NAME} 下指令，或拖一张图进来…`}
                rows={1}
                maxLength={2000}
              />
              <button type="submit" disabled={(!input.trim() && !pending.length) || sending}>
                {sending ? "…" : "发送"}
              </button>
            </div>
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
            {healthAt ? <p className="hermes-grok__probe">上次探测 {formatTime(healthAt)}</p> : null}
          </form>
        </section>

        <aside className="hermes-panel">
          {selected ? (
            <section className="hermes-detail">
              <button type="button" className="hermes-back" onClick={() => goBoard({ kind: "home" })}>
                返回列表
              </button>
              <header className="hermes-panel__who">
                <em>工单</em>
                <strong>{selected.name}</strong>
                <span>
                  {ticketFollow(selected)}
                  {isLiveCase(selected) ? " · 真实对话" : ""}
                </span>
              </header>
              <Fold title="环节进度" open={folds.stages} onToggle={() => toggleFold("stages")}>
                <StageList progress={selected.progress} paused={selected.progress === "hold"} />
              </Fold>
              <Fold title="客户档案" open={folds.customer} onToggle={() => toggleFold("customer")}>
                {fileFacts(selected)}
                <button type="button" className="hermes-link" onClick={() => goBoard({ kind: "customer", key: customerKey(selected) })}>
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
                    <button type="button" className="hermes-link" onClick={() => goBoard({ kind: "factory", name: factoryName(selected) })}>
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
              <button type="button" className="hermes-back" onClick={() => goBoard({ kind: "home" })}>
                返回列表
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
                {fileFacts(customerFile, [{ label: "工厂", value: factoryName(customerFile) || "尚未建档" }])}
              </Fold>
              <Fold title="关联工单" open={folds.related} onToggle={() => toggleFold("related")}>
                <ul className="hermes-tickets__list">
                  {customerTickets.map((item) => (
                    <li key={item.id}>
                      {ticketRow(item, [`${ticketFollow(item)} · ${PROGRESS_LABEL[item.progress]}`, ticketMail(item)], "工单")}
                    </li>
                  ))}
                </ul>
              </Fold>
              {factoryName(customerFile) ? (
                <Fold title="关联工厂" open={folds.factory} onToggle={() => toggleFold("factory")}>
                  <button type="button" className="hermes-link" onClick={() => goBoard({ kind: "factory", name: factoryName(customerFile) })}>
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
              <button type="button" className="hermes-back" onClick={() => goBoard({ kind: "home" })}>
                返回列表
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
                      {ticketRow(
                        item,
                        [`${ticketFollow(item)} · ${PROGRESS_LABEL[item.progress]}`, item.place || "地区尚无"],
                        "工单",
                      )}
                    </li>
                  ))}
                </ul>
              </Fold>
            </section>
          ) : (
            <>
              <section className="hermes-tickets">
                <header>
                  <div>
                    <h3>工单</h3>
                    <p>{visible.length ? `${visible.length} 张` : "还没有工单"} · 每张单子各有六个环节进度</p>
                  </div>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工单或档案" />
                </header>
                <ul>
                  {visible.map((item) => (
                    <li key={item.id}>
                      {ticketRow(
                        item,
                        [
                          `${ticketFollow(item)} · ${PROGRESS_LABEL[item.progress]}`,
                          `${factoryName(item) || "工厂尚未建档"} · ${ticketMail(item)}`,
                        ],
                        "工单",
                      )}
                    </li>
                  ))}
                </ul>
                {!loading && visible.length === 0 ? (
                  <p className="hermes-grok__empty">还没有真实对话，也就还没有客户档案和工厂档案。有了之后，每个客户、每家工厂各有一份。</p>
                ) : null}
              </section>
              <section className="hermes-tickets">
                <header>
                  <div>
                    <h3>客户档案</h3>
                    <p>{customers.length ? `${customers.length} 份 · 每位客户单独一份` : "尚无"}</p>
                  </div>
                </header>
                <ul>
                  {customers.map((item) => (
                    <li key={customerKey(item)}>
                      <button
                        type="button"
                        className="hermes-ticket"
                        onClick={() => goBoard({ kind: "customer", key: customerKey(item) })}
                      >
                        <div className="hermes-ticket__body">
                          <em>客户档案</em>
                          <strong>{item.name}</strong>
                          <span>
                            {ticketFollow(item)} · {item.place || "地区尚无"}
                          </span>
                          <MiniStages progress={item.progress} />
                        </div>
                        <b aria-hidden="true">›</b>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="hermes-tickets">
                <header>
                  <div>
                    <h3>工厂档案</h3>
                    <p>{factories.length ? `${factories.length} 份 · 每家工厂单独一份` : "尚无"}</p>
                  </div>
                </header>
                <ul>
                  {factories.map((row) => (
                    <li key={row.name}>
                      <button type="button" className="hermes-ticket" onClick={() => goBoard({ kind: "factory", name: row.name })}>
                        <div className="hermes-ticket__body">
                          <em>工厂档案</em>
                          <strong>{row.name}</strong>
                          <span>
                            {row.count} 张关联工单 · {PROGRESS_LABEL[row.latest.progress]}
                          </span>
                          <MiniStages progress={row.latest.progress} />
                        </div>
                        <b aria-hidden="true">›</b>
                      </button>
                    </li>
                  ))}
                </ul>
                {!loading && visible.length > 0 && factories.length === 0 ? (
                  <p className="hermes-grok__empty">已有客户工单，工厂名还没写下，所以工厂档案先空着。</p>
                ) : null}
              </section>
              <section>
                <h3>记忆 · {AGENT_NAME} 维护</h3>
                <p className="hermes-lore">{memory.shared || "还没有共用记忆。"}</p>
                <p className="hermes-lore hermes-lore--desk">{memory.desk || "还没有仅后台笔记。"}</p>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
