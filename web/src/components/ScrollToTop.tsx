import { useEffect } from "react"
import { useLocation } from "react-router-dom"

export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Route changes jump instantly; CSS smooth-scroll stays for in-page anchors.
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [pathname])

  return null
}
