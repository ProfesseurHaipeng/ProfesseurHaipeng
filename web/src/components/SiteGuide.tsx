import { useEffect, useRef, useState } from "react"
import { useSiteContent } from "../cms/ContentContext"
import { CHUNK_GAP_MS, splitReplyIntoChunks, typingDelayFor } from "../cms/chunks"
import { buildGreeting } from "../cms/greeting"
import { GUIDE_STARTERS } from "../cms/guidePrompt"
import { flattenKnowledge, localGuideAnswer } from "../cms/knowledge"
import { withBase } from "../lib/asset"

type ChatRole = "user" | "assistant"
type ChatTurn = { role: ChatRole; content: string }
type Stage = "idle" | "connecting" | "live"

function guideEndpoint() {
  const remote = import.meta.env.VITE_GUIDE_URL
  if (typeof remote === "string" && remote.trim()) return remote.trim()
  return withBase("api/guide")
}

function IconClose() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M5.3 5.3a.85.85 0 0 1 1.2 0L10 8.8l3.5-3.5a.85.85 0 1 1 1.2 1.2L11.2 10l3.5 3.5a.85.85 0 1 1-1.2 1.2L10 11.2l-3.5 3.5a.85.85 0 0 1-1.2-1.2L8.8 10 5.3 6.5a.85.85 0 0 1 0-1.2Z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M5 6.8A2.8 2.8 0 0 1 7.8 4h8.4A2.8 2.8 0 0 1 19 6.8v6.4A2.8 2.8 0 0 1 16.2 16H12l-4.2 3.2c-.7.54-1.8.04-1.8-.82V16A2.8 2.8 0 0 1 5 13.2V6.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSend() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path d="M10 3.4c.34 0 .62.28.62.62v9.46l3.04-3.04a.62.62 0 1 1 .88.88l-4.1 4.1a.62.62 0 0 1-.88 0l-4.1-4.1a.62.62 0 1 1 .88-.88L9.38 13.5V4.02c0-.34.28-.62.62-.62Z" fill="currentColor" />
    </svg>
  )
}

const CLOSE_MS = 220
const CONNECT_MIN_MS = 1100

export function SiteGuide() {
  const { content } = useSiteContent()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [stage, setStage] = useState<Stage>("idle")
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[]>([])

  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimer = useRef(0)
  const timers = useRef<Set<number>>(new Set())
  const mounted = useRef(true)
  const turnsRef = useRef<ChatTurn[]>([])
  const busyRef = useRef(false)
  const dirtyRef = useRef(false)
  const greetedRef = useRef(false)

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = window.setTimeout(() => {
        timers.current.delete(id)
        resolve()
      }, ms)
      timers.current.add(id)
    })

  useEffect(
    () => () => {
      mounted.current = false
      window.clearTimeout(closeTimer.current)
      for (const id of timers.current) window.clearTimeout(id)
    },
    [],
  )

  const appendTurn = (turn: ChatTurn) => {
    turnsRef.current = [...turnsRef.current, turn]
    setTurns(turnsRef.current)
  }

  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const deliverReply = async (reply: string) => {
    const chunks = splitReplyIntoChunks(reply)
    for (const chunk of chunks) {
      if (!mounted.current) return
      setTyping(true)
      await sleep(reduceMotion() ? 60 : typingDelayFor(chunk))
      if (!mounted.current) return
      appendTurn({ role: "assistant", content: chunk })
      setTyping(false)
      await sleep(reduceMotion() ? 30 : CHUNK_GAP_MS)
    }
  }

  const fetchReply = async (history: ChatTurn[]) => {
    try {
      const response = await fetch(guideEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((item) => ({ role: item.role, content: item.content })),
        }),
      })
      const payload = (await response.json()) as { reply?: string }
      return payload.reply?.trim() || null
    } catch {
      return null
    }
  }

  const processRounds = async () => {
    if (busyRef.current) {
      dirtyRef.current = true
      return
    }
    busyRef.current = true
    try {
      do {
        dirtyRef.current = false
        const history = turnsRef.current
        const lastUser = [...history].reverse().find((item) => item.role === "user")
        if (!lastUser) break
        setTyping(true)
        const reply = await fetchReply(history)
        if (!mounted.current) return
        await deliverReply(reply ?? localGuideAnswer(lastUser.content, flattenKnowledge(content)))
      } while (dirtyRef.current && mounted.current)
    } finally {
      busyRef.current = false
      if (mounted.current) setTyping(false)
    }
  }

  const send = (text: string) => {
    const question = text.trim()
    if (!question) return
    appendTurn({ role: "user", content: question })
    setInput("")
    inputRef.current?.focus()
    void processRounds()
  }

  const fetchGreeting = async () => {
    try {
      const response = await fetch(guideEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ greet: true }),
      })
      const payload = (await response.json()) as { reply?: string }
      return payload.reply?.trim() || buildGreeting(null)
    } catch {
      return buildGreeting(null)
    }
  }

  // First open: play the "connecting you to an advisor" sequence, then greet.
  useEffect(() => {
    if (!open || greetedRef.current) return
    greetedRef.current = true
    setStage("connecting")
    void (async () => {
      const startedAt = Date.now()
      const greeting = await fetchGreeting()
      const minWait = reduceMotion() ? 120 : CONNECT_MIN_MS
      const elapsed = Date.now() - startedAt
      if (elapsed < minWait) await sleep(minWait - elapsed)
      if (!mounted.current) return
      setStage("live")
      await deliverReply(greeting)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    if (closing) return
    if (reduceMotion()) {
      setOpen(false)
      return
    }
    setClosing(true)
    closeTimer.current = window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, CLOSE_MS)
  }

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [turns, open, typing, stage])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    const id = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const showStarters = stage === "live" && !typing && !turns.some((item) => item.role === "user")
  const statusLabel = stage === "connecting" ? "正在为您接通产品顾问…" : "产品顾问 · 在线"

  return (
    <div className={`site-guide ${open && !closing ? "is-open" : ""}`}>
      {open ? (
        <section className={`site-guide__panel${closing ? " is-closing" : ""}`} aria-label="在线咨询">
          <header className="site-guide__head">
            <div className="site-guide__identity">
              <span className="site-guide__avatar" aria-hidden="true" />
              <div>
                <p className="site-guide__title">在线咨询</p>
                <p className={`site-guide__status${stage === "connecting" ? " is-connecting" : ""}`}>
                  <span className="site-guide__live" aria-hidden="true" />
                  {statusLabel}
                </p>
              </div>
            </div>
            <button type="button" className="site-guide__close" onClick={close} aria-label="关闭">
              <IconClose />
            </button>
          </header>
          <div className="site-guide__log" ref={scroller}>
            {stage === "connecting" ? (
              <p className="site-guide__connect" aria-live="polite">
                正在接入<span className="site-guide__connect-dots"><span /><span /><span /></span>
              </p>
            ) : null}
            {turns.map((turn, index) => (
              <article key={`${turn.role}-${index}`} className={`site-guide__row site-guide__row--${turn.role}`}>
                {turn.role === "assistant" ? <span className="site-guide__avatar site-guide__avatar--sm" aria-hidden="true" /> : null}
                <p className={`site-guide__bubble site-guide__bubble--${turn.role}`}>{turn.content}</p>
              </article>
            ))}
            {typing ? (
              <article className="site-guide__row site-guide__row--assistant" aria-live="polite">
                <span className="site-guide__avatar site-guide__avatar--sm" aria-hidden="true" />
                <p className="site-guide__bubble site-guide__bubble--assistant site-guide__typing">
                  <span />
                  <span />
                  <span />
                  <span className="sr-only">正在输入</span>
                </p>
              </article>
            ) : null}
            {showStarters ? (
              <div className="site-guide__hints">
                {GUIDE_STARTERS.map((item) => (
                  <button key={item} type="button" onClick={() => send(item)}>
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <form
            className="site-guide__form"
            onSubmit={(event) => {
              event.preventDefault()
              send(input)
            }}
          >
            <label className="sr-only" htmlFor="site-guide-input">
              提问
            </label>
            <input
              id="site-guide-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="描述你的问题…"
              maxLength={500}
              autoComplete="off"
            />
            <button className="site-guide__send" type="submit" disabled={!input.trim()} aria-label="发送">
              <IconSend />
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        className="site-guide__toggle"
        aria-expanded={open}
        aria-label={open ? "收起咨询窗口" : "打开在线咨询"}
        onClick={() => {
          if (open) close()
          else setOpen(true)
        }}
      >
        <span className="site-guide__toggle-icon" aria-hidden="true">
          {open ? <IconClose /> : <IconChat />}
        </span>
        <span>{open ? "收起" : "在线咨询"}</span>
      </button>
    </div>
  )
}
