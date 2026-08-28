import { Link } from "react-router-dom"
import { useSiteContent } from "../cms/ContentContext"
import { publicNav } from "../nav"

export function SiteFooter() {
  const { content } = useSiteContent()
  const name = content.settings.brandName || content.settings.productName
  const { channels } = content.settings

  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div>
          <p className="wordmark__zh">{name}</p>
          <p className="faint">{content.settings.tagline}</p>
          <p className="faint">{content.settings.audience}</p>
        </div>
        <nav aria-label="页脚目录">
          {publicNav.map((item) => (
            <Link key={item.id} to={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div>
          {channels.email ? (
            <p>
              <a href={`mailto:${channels.email}`}>{channels.email}</a>
            </p>
          ) : (
            <p className="faint">先留线索，再交换正式联络方式</p>
          )}
          {channels.phone ? (
            <p>
              <a href={`tel:${channels.phone}`}>{channels.phone}</a>
            </p>
          ) : null}
          <p>
            <Link to="/contact">谈合作</Link>
            {" · "}
            <Link to="/admin">内容后台</Link>
          </p>
        </div>
      </div>
      <p className="site-footer__fine">{content.settings.footerNote}</p>
    </footer>
  )
}
