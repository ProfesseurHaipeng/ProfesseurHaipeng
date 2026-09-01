import { useEffect, useRef, useState } from "react"
import { useSiteContent } from "../cms/ContentContext"
import { GUIDE_GREETING, GUIDE_STARTERS } from "../cms/guidePrompt"
import { flattenKnowledge, localGuideAnswer } from "../cms/knowledge"
import { withBase } from "../lib/asset"

type ChatRole = "user" | "assistant"
type ChatTurn = { role: ChatRole; content: string }

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

export function SiteGuide() {
  const { content } = useSiteContent()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content: GUIDE_GREETING,
    },
  ])
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimer = useRef(0)

  const close = () => {
    if (closing) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpen(false)
      return
    }
    setClosing(true)
    closeTimer.current = window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, CLOSE_MS)
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [turns, open, pending])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    const id = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.clearTimeout(id)
    }
  }, [open])

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || pending) return
    const nextTurns: ChatTurn[] = [...turns, { role: "user", content: question }]
    setTurns(nextTurns)
    setInput("")
    setPending(true)
    const localReply = () => localGuideAnswer(question, flattenKnowledge(content))
    try {
      const response = await fetch(guideEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextTurns.map((item) => ({ role: item.role, content: item.content })),
        }),
      })
      const payload = (await response.json()) as { reply?: string }
      setTurns([
        ...nextTurns,
        {
          role: "assistant",
          content: payload.reply?.trim() || localReply(),
        },
      ])
    } catch {
      setTurns([...nextTurns, { role: "assistant", content: localReply() }])
    } finally {
      setPending(false)
    }
  }

  const showStarters = turns.length <= 1 && !pending

  return (
    <div className={`site-guide ${open && !closing ? "is-open" : ""}`}>
      {open ? (
        <section className={`site-guide__panel${closing ? " is-closing" : ""}`} aria-label="站点工单导览">
          <header className="site-guide__head">
            <div className="site-guide__identity">
              <span className="site-guide__avatar" aria-hidden="true" />
              <div>
                <p className="site-guide__title">问本站</p>
                <p className="site-guide__status">
                  <span className="site-guide__live" aria-hidden="true" />
                  工单导览 · 在线
                </p>
              </div>
            </div>
            <button type="button" className="site-guide__close" onClick={close} aria-label="关闭">
              <IconClose />
            </button>
          </header>
          <div className="site-guide__log" ref={scroller}>
            {turns.map((turn, index) => (
              <article key={`${turn.role}-${index}`} className={`site-guide__row site-guide__row--${turn.role}`}>
                {turn.role === "assistant" ? <span className="site-guide__avatar site-guide__avatar--sm" aria-hidden="true" /> : null}
                <p className={`site-guide__bubble site-guide__bubble--${turn.role}`}>{turn.content}</p>
              </article>
            ))}
            {pending ? (
              <article className="site-guide__row site-guide__row--assistant" aria-live="polite">
                <span className="site-guide__avatar site-guide__avatar--sm" aria-hidden="true" />
                <p className="site-guide__bubble site-guide__bubble--assistant site-guide__typing">
                  <span />
                  <span />
                  <span />
                  <span className="sr-only">正在回复</span>
                </p>
              </article>
            ) : null}
            {showStarters ? (
              <div className="site-guide__hints">
                {GUIDE_STARTERS.map((item) => (
                  <button key={item} type="button" disabled={pending} onClick={() => void send(item)}>
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
              void send(input)
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
            <button className="site-guide__send" type="submit" disabled={pending || !input.trim()} aria-label="发送">
              <IconSend />
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        className="site-guide__toggle"
        aria-expanded={open}
        aria-label={open ? "收起工单窗口" : "打开问 AI 工单"}
        onClick={() => {
          if (open) close()
          else setOpen(true)
        }}
      >
        <span className="site-guide__toggle-icon" aria-hidden="true">
          {open ? <IconClose /> : <IconChat />}
        </span>
        <span>{open ? "收起" : "问 AI"}</span>
      </button>
    </div>
  )
}
