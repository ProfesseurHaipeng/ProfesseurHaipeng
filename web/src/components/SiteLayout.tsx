import { Outlet } from "react-router-dom"
import { DocumentMeta } from "./DocumentMeta"
import { DraftMark } from "./DraftMark"
import { PreviewBanner } from "./PreviewBanner"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"

export function SiteLayout() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#site-main">
        跳到正文
      </a>
      <DocumentMeta />
      <PreviewBanner />
      <SiteHeader />
      <DraftMark />
      <main className="site-main" id="site-main">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
