import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { emptyGapCount } from "../cms/gaps"
import { PageHero } from "../components/PageHero"
import { useSiteContent } from "../cms/ContentContext"

export function ContactPage() {
  const { content } = useSiteContent()
  const { contact, settings } = content
  const { channels } = settings
  const missing = emptyGapCount(content)
  const [sent, setSent] = useState(false)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget
    if (import.meta.env.DEV) {
      event.preventDefault()
      setSent(true)
      form.reset()
    }
  }

  return (
    <article className="page wrap contact-page">
      <PageHero kicker={contact.kicker} title={contact.title} lead={contact.lead} />

      <div className="contact-grid">
        <section className="contact-card">
          <h2>怎么联系</h2>
          <dl className="meta-dl">
            <div>
              <dt>邮箱</dt>
              <dd>
                {channels.email ? <a href={`mailto:${channels.email}`}>{channels.email}</a> : "还没填"}
              </dd>
            </div>
            <div>
              <dt>电话</dt>
              <dd>
                {channels.phone ? <a href={`tel:${channels.phone}`}>{channels.phone}</a> : "还没填"}
              </dd>
            </div>
            <div>
              <dt>微信</dt>
              <dd>{channels.wechat || "还没填"}</dd>
            </div>
            <div>
              <dt>地址</dt>
              <dd>{channels.address || "还没填"}</dd>
            </div>
          </dl>
          <ul className="plain-list">
            {contact.cards.map((card) => (
              <li key={card.id}>
                <strong>{card.title}</strong>
                <span>{card.body}</span>
              </li>
            ))}
          </ul>
          <p className="fine">
            {missing > 0
              ? `还有 ${missing} 项对外信息没齐，不影响先留线索。`
              : "对外缺口已齐，可以直接发。"}
          </p>
        </section>

        <section className="contact-card">
          <h2>留一条线索</h2>
          {sent ? (
            <p className="notice">已记下。正式站点发布后，这条会进 Netlify Forms。</p>
          ) : (
            <form
              className="note-form"
              name={contact.formName}
              method="POST"
              data-netlify="true"
              netlify-honeypot="bot-field"
              onSubmit={onSubmit}
            >
              <input type="hidden" name="form-name" value={contact.formName} />
              <p className="sr-only">
                <label>
                  不要填
                  <input name="bot-field" />
                </label>
              </p>
              <label>
                称呼
                <input name="name" required autoComplete="name" />
              </label>
              <label>
                机构
                <input name="org" autoComplete="organization" />
              </label>
              <label>
                邮箱
                <input name="email" type="email" required autoComplete="email" />
              </label>
              <label>
                想谈什么
                <textarea name="note" rows={5} required />
              </label>
              <button className="btn" type="submit">
                发送
              </button>
            </form>
          )}
          {settings.brochureUrl ? (
            <p>
              <a className="text-link" href={settings.brochureUrl}>
                下载手册
              </a>
            </p>
          ) : null}
        </section>
      </div>

      <p className="slogan">{contact.slogan}</p>
      <p>
        <Link className="text-link" to="/next">
          内部：还缺什么 →
        </Link>
      </p>
    </article>
  )
}
