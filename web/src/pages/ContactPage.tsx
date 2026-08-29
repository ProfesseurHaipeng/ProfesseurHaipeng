import { useState, type FormEvent } from "react"
import { emptyGapCount } from "../cms/gaps"
import { MediaFrame } from "../components/MediaFrame"
import { PageHero } from "../components/PageHero"
import { useSiteContent } from "../cms/ContentContext"

function filled(value: string) {
  return value.trim().length > 0
}

export function ContactPage() {
  const { content } = useSiteContent()
  const { contact, settings } = content
  const { channels } = settings
  const missing = emptyGapCount(content)
  const [sent, setSent] = useState(false)
  const hasChannel = filled(channels.email) || filled(channels.phone) || filled(channels.wechat) || filled(channels.address)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = String(data.get("name") ?? "")
    const org = String(data.get("org") ?? "")
    const email = String(data.get("email") ?? "")
    const note = String(data.get("note") ?? "")
    try {
      sessionStorage.setItem(
        "ash-inquiry",
        JSON.stringify({ name, org, email, note, at: new Date().toISOString() }),
      )
    } catch {
      /* ignore quota */
    }
    if (channels.email) {
      const body = [`称呼：${name}`, org ? `机构：${org}` : "", `邮箱：${email}`, "", note]
        .filter(Boolean)
        .join("\n")
      window.location.href = `mailto:${channels.email}?subject=${encodeURIComponent("火山灰合作线索")}&body=${encodeURIComponent(body)}`
    }
    setSent(true)
    form.reset()
  }

  return (
    <article className="page wrap contact-page">
      <PageHero kicker={contact.kicker} title={contact.title} lead={contact.lead} />
      <MediaFrame image={contact.image} caption={contact.image.alt} />

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
            <p>对外邮箱和电话还在定。先把机构和需求写在右边，我们按这条线索回。</p>
          )}
          <ul className="plain-list">
            {contact.cards.map((card) => (
              <li key={card.id}>
                <strong>{card.title}</strong>
                <span>{card.body}</span>
              </li>
            ))}
          </ul>
          <p className="fine">
            {missing > 0 ? "品牌和对外联络还没齐，不影响先谈作物、区域和吨位。" : "对外信息已齐，可以直接发。"}
          </p>
        </section>

        <section className="contact-card">
          <h2>留一条线索</h2>
          {sent ? (
            <p className="notice">
              {channels.email ? "已打开你的邮箱草稿。若没有弹出，请直接写信。" : "已记在这台浏览器里。对外邮箱补上后，这条可以转成正式来信。"}
            </p>
          ) : (
            <form className="note-form" name={contact.formName} method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={onSubmit}>
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
              <button className="btn" type="submit">
                发送
              </button>
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
