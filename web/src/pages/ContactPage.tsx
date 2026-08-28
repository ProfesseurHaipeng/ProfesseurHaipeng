import { useState, type FormEvent } from "react"
import { MediaFrame } from "../components/MediaFrame"
import { PageIntro } from "../components/PageIntro"
import { useSiteContent } from "../cms/ContentContext"

export function ContactPage() {
  const { content } = useSiteContent()
  const page = content.contact
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    const form = event.currentTarget
    const data = new FormData(form)

    if (import.meta.env.DEV) {
      setError("本地预览时便条不会发出。你可以直接在对话里把信息发给我。")
      return
    }

    try {
      const body = new URLSearchParams()
      data.forEach((value, key) => {
        body.append(key, String(value))
      })
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      })
      if (!response.ok) throw new Error("submit failed")
      setSent(true)
      form.reset()
    } catch {
      setError("这次没有送出。请稍后再试，或直接在对话里把信息发给我。")
    }
  }

  return (
    <article className="page">
      <PageIntro kicker={page.kicker} title={page.title} lead={page.lead} />
      <div className="split">
        <MediaFrame image={page.image} />
        <div className="card-grid">
          {page.cards.map((card) => (
            <article className="card" key={card.id}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </div>
      <p className="measure faint">{content.settings.contactHint}</p>
      {sent ? (
        <p className="notice" role="status">
          便条已记下。品牌未定期间，它只作为内容线索。
        </p>
      ) : (
        <form className="note-form" name={page.formName} method="POST" onSubmit={onSubmit}>
          <input type="hidden" name="form-name" value={page.formName} />
          <p className="sr-only">
            <label>
              请勿填写
              <input name="bot-field" />
            </label>
          </p>
          <label>
            怎么称呼
            <input name="name" type="text" autoComplete="name" />
          </label>
          <label>
            回信邮箱
            <input name="email" type="email" autoComplete="email" />
          </label>
          <label>
            要补进官网或希望了解的内容
            <textarea name="note" rows={7} required />
          </label>
          <button className="btn" type="submit">
            留下这条
          </button>
          {error ? (
            <p className="notice notice--warn" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      )}
      <p className="footnote">{page.slogan}</p>
    </article>
  )
}
