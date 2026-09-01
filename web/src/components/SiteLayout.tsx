import { Outlet, useLocation } from "react-router-dom"
import { DocumentMeta } from "./DocumentMeta"
import { PreviewBanner } from "./PreviewBanner"
import { ScrollReveal } from "./ScrollReveal"
import { ScrollToTop } from "./ScrollToTop"
import { SiteFooter } from "./SiteFooter"
import { SiteGuide } from "./SiteGuide"
import { SiteHeader } from "./SiteHeader"

export function SiteLayout() {
  const { pathname } = useLocation()

  return (
    <div className="site-shell">
      <a className="skip-link" href="#site-main">
        跳到正文
      </a>
      <ScrollToTop />
      <ScrollReveal />
      <DocumentMeta />
      <PreviewBanner />
      <SiteHeader />
      <main className="site-main" id="site-main" key={pathname}>
        <Outlet />
      </main>
      <SiteFooter />
      <SiteGuide />
    </div>
  )
}
