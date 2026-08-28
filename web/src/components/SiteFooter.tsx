import { Link } from "react-router-dom"
import { useSiteContent } from "../cms/ContentContext"

export function SiteFooter() {
  const { content } = useSiteContent()
  return (
    <footer className="site-footer">
      <p>{content.settings.footerNote}</p>
      <p className="site-footer__meta">
        <span>{content.settings.brandStatus}</span>
        <Link to="/admin">内容后台</Link>
      </p>
    </footer>
  )
}
