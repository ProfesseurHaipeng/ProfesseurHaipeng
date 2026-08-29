import { Outlet } from "react-router-dom"
import { DocumentMeta } from "./DocumentMeta"
import { PreviewBanner } from "./PreviewBanner"
import { ScrollToTop } from "./ScrollToTop"
import { SiteFooter } from "./SiteFooter"
import { SiteGuide } from "./SiteGuide"
import { SiteHeader } from "./SiteHeader"

export function SiteLayout() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#site-main">
        跳到正文
      </a>
      <ScrollToTop />
      <DocumentMeta />
      <PreviewBanner />
      <SiteHeader />
      <main className="site-main" id="site-main">
        <Outlet />
      </main>
      <SiteFooter />
      <SiteGuide />
    </div>
  )
}
