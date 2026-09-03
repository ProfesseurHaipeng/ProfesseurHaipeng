import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ENERGY_LABEL,
  PROGRESS_LABEL,
  deskStats,
  filterHermesCases,
  type HermesCase,
  type HermesCoachTurn,
  type HermesEnergy,
  type HermesProgress,
} from "../cms/hermesDesk"
import { withBase } from "../lib/asset"
import type { AdminAuth } from "./LeadsPanel"

type FilterFollow = "all" | "following" | "idle"
type FilterOwner = "all" | "hermes" | "human"
type FilterEnergy = "all" | HermesEnergy

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

export function HermesDesk({ auth }: { auth: AdminAuth }) {
  const [cases, setCases] = useState<HermesCase[]>([])
  const [coach, setCoach] = useState<HermesCoachTurn[]>([])
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState("")
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState("")
  const [follow, setFollow] = useState<FilterFollow>("all")
  const [owner, setOwner] = useState<FilterOwner>("all")
  const [energy, setEnergy] = useState<FilterEnergy>("all")
  const [query, setQuery] = useState("")
  const [drafts, setDrafts] = useState<Record<string, Partial<HermesCase>>>({})
  const logRef = useRef<HTMLDivElement>(null)

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "X-Admin-User": auth.user,
      "X-Admin-Pass": auth.pass,
    }),
    [auth.user, auth.pass],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(deskEndpoint(), { headers })
      if (!response.ok) throw new Error(`接口返回 ${response.status}`)
      const payload = (await response.json()) as {
        cases?: HermesCase[]
        coach?: HermesCoachTurn[]
        hermesReady?: boolean
      }
      setCases(Array.isArray(payload.cases) ? payload.cases : [])
      setCoach(Array.isArray(payload.coach) ? payload.coach : [])
      setReady(payload.hermesReady === true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败")
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [coach, sending])

  const post = async (body: Record<string, unknown>) => {
    const response = await fetch(deskEndpoint(), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as {
      cases?: HermesCase[]
      case?: HermesCase
      coach?: HermesCoachTurn[]
      error?: string
    }
    if (!response.ok) throw new Error(payload.error || `接口返回 ${response.status}`)
    if (Array.isArray(payload.cases)) setCases(payload.cases)
    else if (payload.case) {
      setCases((current) => [payload.case as HermesCase, ...current.filter((item) => item.id !== payload.case?.id)])
    }
    if (Array.isArray(payload.coach)) setCoach(payload.coach)
    return payload
  }

  const sync = async () => {
    setError("")
    try {
      await post({ action: "sync" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步失败")
    }
  }

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
    const draft = drafts[item.id] || {}
    setBusyId(item.id)
    setError("")
    try {
      await post({
        action: "update",
        id: item.id,
        progress: draft.progress ?? item.progress,
        reaction: draft.reaction ?? item.reaction,
        evaluation: draft.evaluation ?? item.evaluation,
        energy: draft.energy ?? item.energy,
      })
      setDrafts((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setBusyId("")
    }
  }

  const sendCoach = async () => {
    const message = input.trim()
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

  const visible = filterHermesCases(cases, { follow, owner, energy, query })
  const stats = deskStats(cases)

  return (
    <div className="hermes-desk">
      <header className="hermes-desk__head">
        <div>
          <h2>Hermes 工作台</h2>
          <p className="admin-hint">
            高级顾问的客户档案、跟进状态和内部沟通。
            {ready ? " 网关已接通。" : " 网关还没接通，档案和接管可以先用，对话会先记下来。"}
          </p>
        </div>
        <div className="hermes-desk__tools">
          <button type="button" className="btn btn--ghost" onClick={() => void sync()} disabled={loading}>
            从线索同步
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => void load()} disabled={loading}>
            {loading ? "正在刷新…" : "刷新"}
          </button>
        </div>
      </header>

      <ul className="hermes-desk__stats">
        <li>Hermes 正在跟进 {stats.following}</li>
        <li>尚未跟进 {stats.idle}</li>
        <li>人工接管 {stats.human}</li>
        <li>积极性高 {stats.high}</li>
        <li>积极性低 {stats.low}</li>
      </ul>

      <div className="hermes-desk__filters">
        <label>
          跟进
          <select value={follow} onChange={(event) => setFollow(event.target.value as FilterFollow)}>
            <option value="all">全部</option>
            <option value="following">正在跟进</option>
            <option value="idle">没有在跟进</option>
          </select>
        </label>
        <label>
          接手
          <select value={owner} onChange={(event) => setOwner(event.target.value as FilterOwner)}>
            <option value="all">全部</option>
            <option value="hermes">Hermes</option>
            <option value="human">人工</option>
          </select>
        </label>
        <label>
          积极性
          <select value={energy} onChange={(event) => setEnergy(event.target.value as FilterEnergy)}>
            <option value="all">全部</option>
            <option value="high">高</option>
            <option value="mid">一般</option>
            <option value="low">低</option>
          </select>
        </label>
        <label className="hermes-desk__search">
          筛选
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="称呼、机构、作物…" />
        </label>
      </div>

      {error ? <p className="notice notice--warn">{error}</p> : null}

      <div className="hermes-desk__grid">
        <div className="hermes-desk__board">
          {!loading && visible.length === 0 ? (
            <p className="admin-leads__empty">
              还没有客户档案。可从前台线索同步，或等访客转高级顾问、留下联系方式后自动出现。
            </p>
          ) : null}
          <ul className="hermes-desk__list">
            {visible.map((item) => {
              const draft = drafts[item.id] || {}
              const progress = (draft.progress ?? item.progress) as HermesProgress
              const itemEnergy = (draft.energy ?? item.energy) as HermesEnergy
              return (
                <li key={item.id} className={`hermes-case${item.owner === "human" ? " is-human" : ""}`}>
                  <header>
                    <strong>{item.name}</strong>
                    {item.org ? <span className="admin-lead__org">{item.org}</span> : null}
                    <span className={`hermes-tag hermes-tag--${item.owner}`}>
                      {item.owner === "human" ? "人工跟进" : item.following ? "Hermes 跟进中" : "Hermes 未跟进"}
                    </span>
                    <span className={`hermes-tag hermes-tag--${itemEnergy}`}>{ENERGY_LABEL[itemEnergy]}</span>
                    <time dateTime={item.updatedAt}>{formatTime(item.updatedAt)}</time>
                  </header>
                  <p className="hermes-case__note">{item.note || "还没有线索摘要。"}</p>
                  <dl className="hermes-case__meta">
                    <div>
                      <dt>进度</dt>
                      <dd>{PROGRESS_LABEL[item.progress]}</dd>
                    </div>
                    <div>
                      <dt>客户反响</dt>
                      <dd>{item.reaction || "尚无"}</dd>
                    </div>
                    <div>
                      <dt>Hermes 评价</dt>
                      <dd>{item.evaluation || "尚无"}</dd>
                    </div>
                    <div>
                      <dt>联系</dt>
                      <dd>{item.contact || "未留"}</dd>
                    </div>
                  </dl>
                  <div className="hermes-case__edit">
                    <label>
                      进度
                      <select
                        value={progress}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id], progress: event.target.value as HermesProgress },
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
                      积极性
                      <select
                        value={itemEnergy}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id], energy: event.target.value as HermesEnergy },
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
                        value={draft.reaction ?? item.reaction}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id], reaction: event.target.value },
                          }))
                        }
                        placeholder="客户怎么回应"
                      />
                    </label>
                    <label>
                      评价
                      <input
                        value={draft.evaluation ?? item.evaluation}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id], evaluation: event.target.value },
                          }))
                        }
                        placeholder="Hermes 或同事怎么看"
                      />
                    </label>
                  </div>
                  <footer>
                    {item.owner === "hermes" ? (
                      <button
                        type="button"
                        className="btn"
                        disabled={busyId === item.id}
                        onClick={() => void act(item.id, "takeover")}
                      >
                        {busyId === item.id ? "正在接管…" : "一键人工接管"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        disabled={busyId === item.id}
                        onClick={() => void act(item.id, "resume")}
                      >
                        {busyId === item.id ? "正在交回…" : "一键重新接管"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={busyId === item.id}
                      onClick={() => void saveCase(item)}
                    >
                      保存跟进
                    </button>
                  </footer>
                </li>
              )
            })}
          </ul>
        </div>

        <aside className="hermes-coach">
          <header>
            <h3>和 Hermes 沟通</h3>
            <p className="admin-hint">说明意图、谁先跟、话术怎么改。他可以改上面的档案。</p>
          </header>
          <div className="hermes-coach__log" ref={logRef}>
            {coach.length === 0 ? <p className="admin-hint">还没有内部对话。直接写一条指令即可。</p> : null}
            {coach.map((turn) => (
              <article key={turn.id} className={`hermes-coach__row hermes-coach__row--${turn.role}`}>
                <p>{turn.content}</p>
                <time dateTime={turn.at}>{formatTime(turn.at)}</time>
              </article>
            ))}
            {sending ? <p className="admin-hint">Hermes 正在看档案…</p> : null}
          </div>
          <form
            className="hermes-coach__form"
            onSubmit={(event) => {
              event.preventDefault()
              void sendCoach()
            }}
          >
            <label className="sr-only" htmlFor="hermes-coach-input">
              给 Hermes 的指令
            </label>
            <textarea
              id="hermes-coach-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="例如：王先生先跟样品，积极性低的先放一放，开场少问面积。"
              rows={3}
              maxLength={2000}
            />
            <button className="btn" type="submit" disabled={!input.trim() || sending}>
              {sending ? "发送中…" : "发给 Hermes"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  )
}
