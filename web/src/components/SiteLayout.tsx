import { Outlet } from "react-router-dom"
import { useRouteTransition } from "../lib/routeTransition"
import { DocumentMeta } from "./DocumentMeta"
import { PreviewBanner } from "./PreviewBanner"
import { ScrollReveal } from "./ScrollReveal"
import { SiteFooter } from "./SiteFooter"
import { SiteGuide } from "./SiteGuide"
import { SiteHeader } from "./SiteHeader"

const PHASE_CLASS = {
  "": "",
  exit: " is-exiting",
  enter: " is-entering",
} as const

export function SiteLayout() {
  const { phase } = useRouteTransition()

  return (
    <div className="site-shell">
      <a className="skip-link" href="#site-main">
        跳到正文
      </a>
      <ScrollReveal />
      <DocumentMeta />
      <PreviewBanner />
      <SiteHeader />
      <main className={`site-main${PHASE_CLASS[phase]}`} id="site-main">
        <Outlet />
      </main>
      <SiteFooter />
      <SiteGuide />
    </div>
  )
}
