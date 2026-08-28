import { Outlet } from "react-router-dom"
import { DocumentMeta } from "./DocumentMeta"
import { DraftMark } from "./DraftMark"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"

export function SiteLayout() {
  return (
    <div className="site-shell">
      <DocumentMeta />
      <SiteHeader />
      <DraftMark />
      <main className="site-main">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
