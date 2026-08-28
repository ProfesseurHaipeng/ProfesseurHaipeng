import { useEffect, useState } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { useSiteContent } from "../cms/ContentContext"
import { publicNav } from "../nav"

export function SiteHeader() {
  const { content } = useSiteContent()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const name = content.settings.brandName || content.settings.productName

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  useEffect(() => {
    document.body.classList.toggle("nav-lock", open)
    return () => document.body.classList.remove("nav-lock")
  }, [open])

  return (
    <header className="site-header">
      <NavLink className="wordmark" to="/" onClick={() => setOpen(false)}>
        <span className="wordmark__mark" aria-hidden="true" />
        <span className="wordmark__zh">{name}</span>
      </NavLink>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "收起" : "菜单"}
      </button>
      {open ? (
        <button type="button" className="nav-backdrop" aria-label="关闭菜单" onClick={() => setOpen(false)} />
      ) : null}
      <nav id="site-nav" className={open ? "site-nav is-open" : "site-nav"} aria-label="站点目录">
        {publicNav.map((item) => (
          <NavLink key={item.id} to={item.href} end={item.href === "/"} onClick={() => setOpen(false)}>
            {item.label}
          </NavLink>
        ))}
        <Link className="nav-cta" to="/contact" onClick={() => setOpen(false)}>
          谈合作
        </Link>
      </nav>
    </header>
  )
}
