import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { HermesHealth } from "../cms/hermes"
import {
  CHANNEL_LABEL,
  ENERGY_LABEL,
  MAIL_STATUS_LABEL,
  MAIL_TRACK_LABEL,
  PROGRESS_LABEL,
  PROGRESS_TRACK,
  boardMetrics,
  emptyMemory,
  filterHermesCases,
  formatInquiryRate,
  formatPace,
  isLiveCase,
  normalizeCase,
  progressRatio,
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

function ProgressRail({
  value,
  label,
  paused,
}: {
  value: number
  label: string
  paused?: boolean
}) {
  return (
    <div className={`hermes-rail${paused ? " is-paused" : ""}`}>
      <div className="hermes-rail__meta">
        <span>{label}</span>
        <b>{percent(value)}</b>
      </div>
      <div className="hermes-rail__track" aria-hidden="true">
        <i style={{ width: percent(value) }} />
      </div>
      <ol>
        {PROGRESS_TRACK.map((step) => (
          <li key={step} className={PROGRESS_LABEL[step] === label || progressRatio(step) <= value + 0.01 ? "is-on" : ""}>
            {PROGRESS_LABEL[step]}
          </li>
        ))}
      </ol>
    </div>
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
  const [board, setBoard] = useState(() => boardMetrics([]))
  const [link, setLink] = useState<HermesDeskLink>({ configured: false, model: "", host: "" })
  const [status, setStatus] = useState<LinkView>("connecting")
  const [healthAt, setHealthAt] = useState("")
  const [healthDetail, setHealthDetail] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [pane, setPane] = useState<MobilePane>("chat")
  const [pending, setPending] = useState<PendingImage[]>([])
  const [dragOver, setDragOver] = useState(false)
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
    if (payload.board) setBoard(payload.board)
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
  const selected = cases.map(normalizeCase).find((item) => item.id === selectedId) || null
  const timeline = events.filter((item) => !selected || !item.caseId || item.caseId === selected.id).slice(-12).reverse()

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

  const inquiryMeter = selected?.inquiryCount ? Math.min(1, selected.inquiryCount / 8) : 0
  const rateHint = selected ? formatInquiryRate(selected) : ""
  const rateMeter = selected?.inquiryCount
    ? Math.min(1, (selected.inquiryCount || 0) / Math.max(1, (Date.now() - Date.parse(selected.at)) / 86400000) / 4)
    : 0
  const replyMeter = selected?.replyPaceMin != null ? Math.max(0.12, 1 - Math.min(selected.replyPaceMin, 240) / 240) : 0
  const inquirePaceMeter = selected?.inquiryPaceMin != null ? Math.max(0.12, 1 - Math.min(selected.inquiryPaceMin, 7 * 24 * 60) / (7 * 24 * 60)) : 0
  const mailReplyMeter = selected?.emailReplyHours != null ? Math.max(0.12, 1 - Math.min(selected.emailReplyHours, 72) / 72) : 0

  return (
    <div className="hermes-grok hermes-hud">
      <div className={`hermes-scan${status === "connecting" ? " is-on" : ""}`} aria-hidden="true" />
      <header className="hermes-grok__top">
        <div className="hermes-grok__brand">
          <strong>{AGENT_NAME}</strong>
          <span>看板只读 · 同事只通过对话指挥</span>
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
              <button type="button" className="hermes-back" onClick={() => setSelectedId("")}>
                返回单子
              </button>
              <header className="hermes-panel__who">
                <strong>{selected.name}</strong>
                <span>
                  {ticketFollow(selected)}
                  {isLiveCase(selected) ? " · 真实对话" : ""}
                </span>
              </header>
              <ProgressRail
                value={progressRatio(selected.progress)}
                label={PROGRESS_LABEL[selected.progress]}
                paused={selected.progress === "hold"}
              />
              <section>
                <h3>邮件</h3>
                <ul className="hermes-mail">
                  <li className={selected.mailStatus !== "none" ? "is-on" : ""}>
                    {MAIL_STATUS_LABEL[selected.mailStatus || "none"]}
                    {selected.mailSentAt ? ` · ${formatTime(selected.mailSentAt)}` : ""}
                  </li>
                  <li className={selected.mailFollowUp ? "is-on" : ""}>{selected.mailFollowUp ? "有跟单" : "无跟单"}</li>
                  <li className={selected.mailTracking && selected.mailTracking !== "none" ? "is-on" : ""}>
                    {MAIL_TRACK_LABEL[selected.mailTracking || "none"]}
                  </li>
                </ul>
                <p className="hermes-sum">{selected.mailSummary || `还没有客户回邮摘要。${AGENT_NAME} 读到真邮件后再写。`}</p>
              </section>
              <section>
                <h3>客户行为</h3>
                <div className="hermes-meters">
                  <Meter label="询单次数" value={inquiryMeter} hint={selected.inquiryCount ? `${selected.inquiryCount} 次` : "尚无"} />
                  <Meter label="询单速度" value={rateMeter} hint={rateHint || "尚无"} />
                  <Meter label="询单间隔" value={inquirePaceMeter} hint={formatPace(selected.inquiryPaceMin) || "尚无"} />
                  <Meter label="回复速度" value={replyMeter} hint={formatPace(selected.replyPaceMin) || "尚无"} />
                  <Meter label="回邮用时" value={mailReplyMeter} hint={selected.emailReplyHours != null ? `${selected.emailReplyHours} 小时` : "尚无"} />
                </div>
              </section>
              <dl className="hermes-facts">
                <div>
                  <dt>意向</dt>
                  <dd>{ENERGY_LABEL[selected.energy]}</dd>
                </div>
                <div>
                  <dt>渠道</dt>
                  <dd>{CHANNEL_LABEL[selected.lastChannel || "unset"]}</dd>
                </div>
                <div>
                  <dt>对话轮次</dt>
                  <dd>{selected.chatTurns || "尚无"}</dd>
                </div>
                <div>
                  <dt>下一步</dt>
                  <dd>{selected.nextAction || "尚无"}</dd>
                </div>
                <div>
                  <dt>线索</dt>
                  <dd>{selected.note || "尚无"}</dd>
                </div>
                <div>
                  <dt>反响 / 评价</dt>
                  <dd>{selected.reaction || selected.evaluation || "尚无"}</dd>
                </div>
              </dl>
              <section className="hermes-grok__time">
                <h3>这条单的时间线</h3>
                {timeline.length === 0 ? <p className="hermes-grok__empty">还没有事件。</p> : null}
                <ol>
                  {timeline.map((item) => (
                    <li key={item.id}>
                      <time dateTime={item.at}>{formatTime(item.at)}</time>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </section>
          ) : (
            <>
              <section className="hermes-tickets">
                <header>
                  <div>
                    <h3>单子</h3>
                    <p>
                      {visible.length ? `${visible.length} 张真实对话` : "还没有单子"}
                      {board.live ? ` · 点进去看详细进度` : ""}
                    </p>
                  </div>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" />
                </header>
                <ul>
                  {visible.map((item) => (
                    <li key={item.id}>
                      <button type="button" className="hermes-ticket" onClick={() => setSelectedId(item.id)}>
                        <strong>{item.name}</strong>
                        <span>{ticketFollow(item)} · {PROGRESS_LABEL[item.progress]}</span>
                        <span>{ticketMail(item)}</span>
                        <div className="hermes-rail__track hermes-ticket__bar" aria-hidden="true">
                          <i style={{ width: percent(progressRatio(item.progress)) }} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                {!loading && visible.length === 0 ? (
                  <p className="hermes-grok__empty">还没有前台高级顾问对话。有真实单子后，这里会先看到跟进和进度，点进去才看详情。</p>
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
