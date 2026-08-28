import { useState } from "react"
import { NavLink } from "react-router-dom"
import { useSiteContent } from "../cms/ContentContext"

export function SiteHeader() {
  const { content } = useSiteContent()
  const [open, setOpen] = useState(false)
  const name = content.settings.brandName || content.settings.productName

  return (
    <header className="site-header">
      <NavLink className="wordmark" to="/" onClick={() => setOpen(false)}>
        <span className="wordmark__zh">{name}</span>
        <span className="wordmark__en">{content.settings.latinName}</span>
      </NavLink>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "收起" : "目录"}
      </button>
      <nav id="site-nav" className={open ? "site-nav is-open" : "site-nav"} aria-label="站点目录">
        {content.nav.map((item) => (
          <NavLink key={item.id} to={item.href} end={item.href === "/"} onClick={() => setOpen(false)}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
