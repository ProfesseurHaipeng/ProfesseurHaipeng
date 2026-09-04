import { useState, type FormEvent } from "react"
import { PageHero } from "../components/PageHero"
import { useSiteContent } from "../cms/ContentContext"
import { withBase } from "../lib/asset"

function filled(value: string) {
  return value.trim().length > 0
}

export function ContactPage() {
  const { content } = useSiteContent()
  const { contact, settings } = content
  const { channels } = settings
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const hasChannel =
    filled(channels.email) || filled(channels.phone) || filled(channels.wechat) || filled(channels.address)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const lead = {
      name: String(data.get("name") ?? ""),
      org: String(data.get("org") ?? ""),
      email: String(data.get("email") ?? ""),
      note: String(data.get("note") ?? ""),
    }
    setSending(true)
    setFailed(false)
    try {
      sessionStorage.setItem("ash-inquiry", JSON.stringify({ ...lead, at: new Date().toISOString() }))
    } catch {
      /* ignore quota */
    }
    let stored = false
    try {
      const response = await fetch(withBase("api/leads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      })
      stored = response.ok
    } catch {
      stored = false
    }
    if (!stored && channels.email) {
      const body = [`称呼：${lead.name}`, lead.org ? `机构：${lead.org}` : "", `邮箱：${lead.email}`, "", lead.note]
        .filter(Boolean)
        .join("\n")
      window.location.href = `mailto:${channels.email}?subject=${encodeURIComponent("火山灰合作线索")}&body=${encodeURIComponent(body)}`
      stored = true
    }
    setSending(false)
    if (stored) {
      setSent(true)
      form.reset()
    } else {
      setFailed(true)
    }
  }

  return (
    <article className="page wrap contact-page">
      <PageHero kicker={contact.kicker} title={contact.title} lead={contact.lead} image={contact.image} />

      <div className="contact-grid">
        <section className="contact-card">
          <h2>怎么联系</h2>
          {hasChannel ? (
            <dl className="meta-dl">
              {filled(channels.email) ? (
                <div>
                  <dt>邮箱</dt>
                  <dd>
                    <a href={`mailto:${channels.email}`}>{channels.email}</a>
                  </dd>
                </div>
              ) : null}
              {filled(channels.phone) ? (
                <div>
                  <dt>电话</dt>
                  <dd>
                    <a href={`tel:${channels.phone}`}>{channels.phone}</a>
                  </dd>
                </div>
              ) : null}
              {filled(channels.wechat) ? (
                <div>
                  <dt>微信</dt>
                  <dd>{channels.wechat}</dd>
                </div>
              ) : null}
              {filled(channels.address) ? (
                <div>
                  <dt>地址</dt>
                  <dd>{channels.address}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p>对外邮箱和电话还在定。先把机构和需求写在表单里，我们按这条线索回。</p>
          )}
          <ul className="plain-list">
            {contact.cards.map((card) => (
              <li key={card.id}>
                <strong>{card.title}</strong>
                <span>{card.body}</span>
              </li>
            ))}
          </ul>
          <p className="fine">留下作物、区域和吨位即可。</p>
        </section>

        <section className="contact-card">
          <h2>留一条线索</h2>
          {sent ? (
            <div className="notice">
              <p>已记下这条线索，我们的工作人员会尽快按这条线索联系您。</p>
              <button className="text-link" type="button" onClick={() => setSent(false)}>
                再留一条
              </button>
            </div>
          ) : (
            <form
              className="note-form"
              name={contact.formName}
              method="POST"
              data-netlify="true"
              netlify-honeypot="bot-field"
              onSubmit={(event) => void onSubmit(event)}
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
                作物、区域或吨位
                <textarea name="note" rows={5} required placeholder="例如：江西水稻基地，先问样品和检测。" />
              </label>
              <button className="btn" type="submit" disabled={sending}>
                {sending ? "正在发送…" : "发送"}
              </button>
              {failed ? <p className="notice notice--warn">刚才没送出去，请稍后再试一次。</p> : null}
            </form>
          )}
          {settings.brochureUrl ? (
            <p>
              <a className="text-link" href={settings.brochureUrl}>
                下载资料
              </a>
            </p>
          ) : null}
        </section>
      </div>

      <p className="slogan">{contact.slogan}</p>
    </article>
  )
}
