import { useEffect, useRef, useState } from "react"

type ChatRole = "user" | "assistant"
type ChatTurn = { role: ChatRole; content: string }

const starters = ["这是什么项目？", "水稻怎么用？", "检测里有什么？", "怎么谈合作？"]

export function SiteGuide() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content: "我是本站导览，可以介绍项目、产品、作物方案、案例和联络方式。",
    },
  ])
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [turns, open])

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || pending) return
    const nextTurns: ChatTurn[] = [...turns, { role: "user", content: question }]
    setTurns(nextTurns)
    setInput("")
    setPending(true)
    try {
      const response = await fetch("/api/guide", {
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
          content: payload.reply || "这一问暂时没有接到模型，请换个说法，或到联络页留下作物和吨位。",
        },
      ])
    } catch {
      setTurns([
        ...nextTurns,
        { role: "assistant", content: "网络暂时不通。你可以直接打开「产品」「应用」或「联络」。" },
      ])
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={`site-guide ${open ? "is-open" : ""}`}>
      {open ? (
        <section className="site-guide__panel" aria-label="站点导览">
          <header className="site-guide__head">
            <p className="eyebrow">Guide</p>
            <h2>问本站</h2>
            <button type="button" className="site-guide__close" onClick={() => setOpen(false)}>
              关闭
            </button>
          </header>
          <div className="site-guide__log" ref={scroller}>
            {turns.map((turn, index) => (
              <p key={`${turn.role}-${index}`} className={`site-guide__bubble site-guide__bubble--${turn.role}`}>
                {turn.content}
              </p>
            ))}
            {pending ? <p className="site-guide__bubble site-guide__bubble--assistant">正在对照站点文案…</p> : null}
          </div>
          <div className="site-guide__hints">
            {starters.map((item) => (
              <button key={item} type="button" className="chip" onClick={() => void send(item)}>
                {item}
              </button>
            ))}
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
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="问作物、检测或联络"
              maxLength={500}
              autoComplete="off"
            />
            <button className="btn" type="submit" disabled={pending}>
              发送
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        className="site-guide__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "收起" : "问 AI"}
      </button>
    </div>
  )
}
