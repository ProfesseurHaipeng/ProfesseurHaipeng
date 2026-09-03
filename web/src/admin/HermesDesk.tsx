import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { HermesHealth } from "../cms/hermes"
import {
  ENERGY_LABEL,
  PROGRESS_LABEL,
  attentionCases,
  deskStats,
  emptyMemory,
  filterHermesCases,
  isLiveCase,
  pipelineStats,
  type HermesAttachable,
  type HermesCase,
  type HermesCoachTurn,
  type HermesDeskLink,
  type HermesEnergy,
  type HermesEvent,
  type HermesMemory,
  type HermesProgress,
} from "../cms/hermesDesk"
import { withBase } from "../lib/asset"
import type { AdminAuth } from "./LeadsPanel"

type FilterFollow = "all" | "following" | "idle"
type FilterOwner = "all" | "hermes" | "human"
type FilterEnergy = "all" | HermesEnergy
type LinkView = "connecting" | "connected" | "disconnected"
type MobilePane = "chat" | "people" | "file"

const STATUS_LABEL: Record<LinkView, string> = {
  connecting: "正在连接",
  connected: "正常连接",
  disconnected: "断开连接",
}

const STARTERS = ["先跟刚转过来的客户", "待评估的先标一下", "样品进度同步一下"]

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

type DeskPayload = {
  cases?: HermesCase[]
  coach?: HermesCoachTurn[]
  events?: HermesEvent[]
  memory?: HermesMemory
  link?: HermesDeskLink
  health?: HermesHealth | null
  hermesReady?: boolean
  attachable?: HermesAttachable[]
  case?: HermesCase
  reply?: string
  error?: string
}

export function HermesDesk({ auth }: { auth: AdminAuth }) {
  const [cases, setCases] = useState<HermesCase[]>([])
  const [coach, setCoach] = useState<HermesCoachTurn[]>([])
  const [events, setEvents] = useState<HermesEvent[]>([])
  const [memory, setMemory] = useState<HermesMemory>(emptyMemory())
  const [attachable, setAttachable] = useState<HermesAttachable[]>([])
  const [link, setLink] = useState<HermesDeskLink>({ configured: false, model: "", host: "" })
  const [status, setStatus] = useState<LinkView>("connecting")
  const [healthAt, setHealthAt] = useState("")
  const [healthDetail, setHealthDetail] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState("")
  const [sending, setSending] = useState(false)
  const [savingMemory, setSavingMemory] = useState(false)
  const [input, setInput] = useState("")
  const [note, setNote] = useState("")
  const [origin, setOrigin] = useState<"live" | "all">("live")
  const [follow, setFollow] = useState<FilterFollow>("all")
  const [owner, setOwner] = useState<FilterOwner>("all")
  const [energy, setEnergy] = useState<FilterEnergy>("all")
  const [progressFilter, setProgressFilter] = useState<HermesProgress | "all">("all")
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [pane, setPane] = useState<MobilePane>("chat")
  const [drafts, setDrafts] = useState<Record<string, Partial<HermesCase>>>({})
  const [sharedDraft, setSharedDraft] = useState("")
  const [deskDraft, setDeskDraft] = useState("")
  const logRef = useRef<HTMLDivElement>(null)

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "X-Admin-User": auth.user,
      "X-Admin-Pass": auth.pass,
    }),
    [auth.user, auth.pass],
  )

  const apply = useCallback((payload: DeskPayload) => {
    if (Array.isArray(payload.cases)) setCases(payload.cases)
    if (Array.isArray(payload.coach)) setCoach(payload.coach)
    if (Array.isArray(payload.events)) setEvents(payload.events)
    if (payload.memory) setMemory(payload.memory)
    if (Array.isArray(payload.attachable)) setAttachable(payload.attachable)
    if (payload.link) setLink(payload.link)
    if (payload.health) {
      setStatus(payload.health.status === "connected" ? "connected" : "disconnected")
      setHealthAt(payload.health.checkedAt || "")
      setHealthDetail(payload.health.detail || "")
    }
    if (payload.case) {
      setCases((current) => [payload.case as HermesCase, ...current.filter((item) => item.id !== payload.case?.id)])
      setSelectedId(payload.case.id)
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
      if (!response.ok) throw new Error(payload.error || `接口返回 ${response.status}`)
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

  useEffect(() => {
    setSharedDraft(memory.shared)
    setDeskDraft(memory.desk)
  }, [memory.desk, memory.shared, memory.updatedAt])

  const visible = filterHermesCases(cases, { follow, owner, energy, query, origin }).filter((item) =>
    progressFilter === "all" ? true : item.progress === progressFilter,
  )
  const selected = cases.find((item) => item.id === selectedId) || visible[0] || null
  const stats = deskStats(cases)
  const attention = attentionCases(cases)
  const pipeline = pipelineStats(cases)
  const timeline = events.filter((item) => !selected || !item.caseId || item.caseId === selected.id).slice(-16).reverse()
  const draft = selected ? drafts[selected.id] || {} : {}

  const act = async (id: string, action: "takeover" | "resume") => {
    setBusyId(id)
    setError("")
    try {
      await post({ action, id })
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败")
    } finally {
      setBusyId("")
    }
  }

  const saveCase = async (item: HermesCase) => {
    const next = drafts[item.id] || {}
    setBusyId(item.id)
    setError("")
    try {
      await post({
        action: "update",
        id: item.id,
        progress: next.progress ?? item.progress,
        reaction: next.reaction ?? item.reaction,
        evaluation: next.evaluation ?? item.evaluation,
        energy: next.energy ?? item.energy,
      })
      setDrafts((current) => {
        const copy = { ...current }
        delete copy[item.id]
        return copy
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setBusyId("")
    }
  }

  const saveMemory = async () => {
    setSavingMemory(true)
    setError("")
    try {
      await post({ action: "memory", shared: sharedDraft, desk: deskDraft })
    } catch (err) {
      setError(err instanceof Error ? err.message : "记忆未保存")
    } finally {
      setSavingMemory(false)
    }
  }

  const sendCoach = async (preset?: string) => {
    const message = (preset ?? input).trim()
    if (!message || sending) return
    setSending(true)
    setError("")
    setInput("")
    try {
      await post({ action: "coach", message })
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败")
      setInput(message)
    } finally {
      setSending(false)
    }
  }

  const sendNote = async () => {
    if (!selected || !note.trim()) return
    setBusyId(selected.id)
    try {
      await post({ action: "note", id: selected.id, text: note.trim() })
      setNote("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "笔记未写入")
    } finally {
      setBusyId("")
    }
  }

  return (
    <div className="hermes-grok">
      <header className="hermes-grok__top">
        <div className="hermes-grok__brand">
          <strong>Hermes</strong>
          <span>后台工作台 · 与前台高级顾问是同一个人</span>
        </div>
        <p className={`hermes-grok__status hermes-grok__status--${status}`} title={healthDetail || undefined}>
          <i />
          {STATUS_LABEL[status]}
          {link.model && status === "connected" ? <em>{link.model}</em> : null}
          {status === "disconnected" && link.configured ? <em>{link.host || "网关不可达"}</em> : null}
          {status === "disconnected" && !link.configured ? <em>未配置网关</em> : null}
        </p>
        <div className="hermes-grok__tools">
          <button type="button" className="hermes-grok__ghost" onClick={() => void probe()}>
            探测连接
          </button>
          <button type="button" className="hermes-grok__ghost" onClick={() => void load()} disabled={loading}>
            {loading ? "刷新中" : "刷新"}
          </button>
          {stats.archived > 0 ? (
            <button
              type="button"
              className="hermes-grok__ghost"
              onClick={() => void post({ action: "prune" }).catch((err) => setError(err instanceof Error ? err.message : "清理失败"))}
            >
              清理空表单卡 {stats.archived}
            </button>
          ) : null}
        </div>
      </header>

      <nav className="hermes-grok__tabs" aria-label="工作台分区">
        {(
          [
            ["chat", "对话"],
            ["people", "客户"],
            ["file", "档案"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" className={pane === key ? "is-on" : ""} onClick={() => setPane(key)}>
            {label}
          </button>
        ))}
      </nav>

      {error ? <p className="hermes-grok__error">{error}</p> : null}

      <div className={`hermes-grok__body hermes-grok__body--${pane}`}>
        <aside className="hermes-grok__rail">
          <section>
            <h3>看板</h3>
            <ul className="hermes-grok__pills">
              <li>真实对话 {stats.live}</li>
              <li>跟进中 {stats.following}</li>
              <li>人工 {stats.human}</li>
              <li>高意向 {stats.high}</li>
            </ul>
            <div className="hermes-grok__pipe">
              {(Object.keys(PROGRESS_LABEL) as HermesProgress[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={progressFilter === key ? "is-on" : ""}
                  onClick={() => setProgressFilter((current) => (current === key ? "all" : key))}
                >
                  {PROGRESS_LABEL[key]}
                  <b>{pipeline[key] || 0}</b>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>需要看</h3>
            <div className="hermes-grok__attn">
              <button type="button" onClick={() => attention.human[0] && setSelectedId(attention.human[0].id)}>
                人工接管 {attention.human.length}
              </button>
              <button type="button" onClick={() => attention.high[0] && setSelectedId(attention.high[0].id)}>
                积极性高 {attention.high.length}
              </button>
              <button type="button" onClick={() => attention.stale[0] && setSelectedId(attention.stale[0].id)}>
                待评估 {attention.stale.length}
              </button>
            </div>
          </section>

          <section className="hermes-grok__people">
            <header>
              <h3>客户</h3>
              <label>
                <input
                  type="checkbox"
                  checked={origin === "live"}
                  onChange={(event) => setOrigin(event.target.checked ? "live" : "all")}
                />
                仅真实对话
              </label>
            </header>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索称呼、机构、作物" />
            <div className="hermes-grok__filters">
              <select value={follow} onChange={(event) => setFollow(event.target.value as FilterFollow)}>
                <option value="all">跟进</option>
                <option value="following">正在跟</option>
                <option value="idle">未跟</option>
              </select>
              <select value={owner} onChange={(event) => setOwner(event.target.value as FilterOwner)}>
                <option value="all">接手</option>
                <option value="hermes">Hermes</option>
                <option value="human">人工</option>
              </select>
              <select value={energy} onChange={(event) => setEnergy(event.target.value as FilterEnergy)}>
                <option value="all">意向</option>
                <option value="high">高</option>
                <option value="mid">一般</option>
                <option value="low">低</option>
                <option value="unset">未评估</option>
              </select>
            </div>
            <ul>
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={selected?.id === item.id ? "is-on" : ""}
                    onClick={() => {
                      setSelectedId(item.id)
                      setPane("file")
                    }}
                  >
                    <strong>{item.name}</strong>
                    <span>
                      {item.owner === "human" ? "人工" : item.following ? "跟进中" : "未跟"}
                      {item.energy !== "unset" ? ` · ${ENERGY_LABEL[item.energy]}` : ""}
                    </span>
                    <em>{item.note || "还没有线索"}</em>
                  </button>
                </li>
              ))}
            </ul>
            {!loading && visible.length === 0 ? (
              <p className="hermes-grok__empty">
                {origin === "live"
                  ? "还没有前台高级顾问对话。访客点「转高级顾问」后会出现。联络表线索在「前台线索」，不会自动变成 Hermes 档案。"
                  : "没有符合筛选的档案。"}
              </p>
            ) : null}
          </section>

          {attachable.length > 0 ? (
            <section>
              <h3>可接入的 AI 工单</h3>
              <ul className="hermes-grok__attach">
                {attachable.map((item) => (
                  <li key={item.id}>
                    <span>{item.name}</span>
                    <button type="button" onClick={() => void post({ action: "attach", leadId: item.id })}>
                      接入
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>

        <section className="hermes-grok__chat">
          <div className="hermes-grok__log" ref={logRef}>
            {coach.length === 0 && !sending ? (
              <div className="hermes-grok__hello">
                <h2>Hermes</h2>
                <p>后台和前台是同一个人、同一份长期记忆。这里权限更高，前台看不到工作台数据。</p>
                <div>
                  {STARTERS.map((item) => (
                    <button key={item} type="button" onClick={() => void sendCoach(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {coach.map((turn) => (
              <article key={turn.id} className={`hermes-grok__bubble hermes-grok__bubble--${turn.role}`}>
                <p>{turn.content}</p>
                <time dateTime={turn.at}>{turn.role === "staff" ? "同事" : "Hermes"} · {formatTime(turn.at)}</time>
              </article>
            ))}
            {sending ? <p className="hermes-grok__typing">Hermes 正在看档案…</p> : null}
          </div>
          <form
            className="hermes-grok__composer"
            onSubmit={(event) => {
              event.preventDefault()
              void sendCoach()
            }}
          >
            <label className="sr-only" htmlFor="hermes-grok-input">
              给 Hermes 的指令
            </label>
            <textarea
              id="hermes-grok-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void sendCoach()
                }
              }}
              placeholder="给 Hermes 一条指令。他和前台是同一个人，只是这里看得更多。"
              rows={2}
              maxLength={2000}
            />
            <button type="submit" disabled={!input.trim() || sending}>
              {sending ? "…" : "发送"}
            </button>
          </form>
          {healthAt ? <p className="hermes-grok__probe">上次探测 {formatTime(healthAt)}</p> : null}
        </section>

        <aside className="hermes-grok__file">
          {selected ? (
            <>
              <header>
                <strong>{selected.name}</strong>
                {selected.org ? <span>{selected.org}</span> : null}
                <p>
                  {selected.owner === "human" ? "人工跟进" : selected.following ? "Hermes 跟进中" : "Hermes 未跟进"}
                  {" · "}
                  {PROGRESS_LABEL[selected.progress]}
                  {isLiveCase(selected) ? " · 真实对话" : " · 历史表单"}
                </p>
              </header>
              <p className="hermes-grok__clue">{selected.note || "还没有线索摘要。"}</p>
              <dl>
                <div>
                  <dt>联系</dt>
                  <dd>{selected.contact || "未留"}</dd>
                </div>
                <div>
                  <dt>反响</dt>
                  <dd>{selected.reaction || "尚无"}</dd>
                </div>
                <div>
                  <dt>评价</dt>
                  <dd>{selected.evaluation || "尚无"}</dd>
                </div>
              </dl>
              <div className="hermes-grok__edit">
                <label>
                  进度
                  <select
                    value={(draft.progress ?? selected.progress) as HermesProgress}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [selected.id]: { ...current[selected.id], progress: event.target.value as HermesProgress },
                      }))
                    }
                  >
                    {Object.entries(PROGRESS_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  意向
                  <select
                    value={(draft.energy ?? selected.energy) as HermesEnergy}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [selected.id]: { ...current[selected.id], energy: event.target.value as HermesEnergy },
                      }))
                    }
                  >
                    {Object.entries(ENERGY_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  反响
                  <input
                    value={draft.reaction ?? selected.reaction}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [selected.id]: { ...current[selected.id], reaction: event.target.value },
                      }))
                    }
                    placeholder="客户怎么回应"
                  />
                </label>
                <label>
                  评价
                  <input
                    value={draft.evaluation ?? selected.evaluation}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [selected.id]: { ...current[selected.id], evaluation: event.target.value },
                      }))
                    }
                    placeholder="Hermes 或同事怎么看"
                  />
                </label>
              </div>
              <footer>
                {selected.owner === "hermes" ? (
                  <button type="button" disabled={busyId === selected.id} onClick={() => void act(selected.id, "takeover")}>
                    {busyId === selected.id ? "接管中…" : "人工接管"}
                  </button>
                ) : (
                  <button type="button" disabled={busyId === selected.id} onClick={() => void act(selected.id, "resume")}>
                    {busyId === selected.id ? "交回中…" : "交回 Hermes"}
                  </button>
                )}
                <button type="button" disabled={busyId === selected.id} onClick={() => void saveCase(selected)}>
                  保存档案
                </button>
              </footer>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void sendNote()
                }}
              >
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="写一条仅后台可见的笔记" />
                <button type="submit" disabled={!note.trim()}>
                  记下
                </button>
              </form>
            </>
          ) : (
            <p className="hermes-grok__empty">选左边一位真实客户，档案会出现在这里。</p>
          )}

          <section className="hermes-grok__memory">
            <h3>长期记忆 · 前后台共用</h3>
            <textarea value={sharedDraft} onChange={(event) => setSharedDraft(event.target.value)} rows={4} maxLength={8000} />
            <h3>工作台笔记 · 仅后台</h3>
            <textarea value={deskDraft} onChange={(event) => setDeskDraft(event.target.value)} rows={4} maxLength={8000} />
            <button type="button" onClick={() => void saveMemory()} disabled={savingMemory}>
              {savingMemory ? "保存中…" : "保存记忆"}
            </button>
            {memory.updatedAt ? <small>上次 {formatTime(memory.updatedAt)}</small> : null}
          </section>

          <section className="hermes-grok__time">
            <h3>时间线</h3>
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
        </aside>
      </div>
    </div>
  )
}
