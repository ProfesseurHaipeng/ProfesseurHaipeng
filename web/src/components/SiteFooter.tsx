import { Link } from "react-router-dom"
import { useSiteContent } from "../cms/ContentContext"

export function SiteFooter() {
  const { content } = useSiteContent()
  return (
    <footer className="site-footer">
      <p>{content.settings.footerNote}</p>
      <p className="site-footer__meta">
        <span>{content.settings.brandStatus}</span>
        {content.settings.channels.email ? (
          <a href={`mailto:${content.settings.channels.email}`}>{content.settings.channels.email}</a>
        ) : null}
        {content.settings.brochureUrl ? (
          <a href={content.settings.brochureUrl} target="_blank" rel="noreferrer">
            下载手册
          </a>
        ) : null}
        <Link to="/next">待补清单</Link>
        <Link to="/admin">内容后台</Link>
      </p>
    </footer>
  )
}
