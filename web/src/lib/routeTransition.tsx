import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react"
import { useLocation, type Location } from "react-router-dom"

export type RoutePhase = "" | "exit" | "enter"

type RouteTransitionState = {
  location: Location
  phase: RoutePhase
}

const RouteTransitionContext = createContext<RouteTransitionState | null>(null)

export function useRouteTransition(): RouteTransitionState {
  const fallback = useLocation()
  const ctx = useContext(RouteTransitionContext)
  return ctx ?? { location: fallback, phase: "" }
}

const EXIT_MS = 170
const ENTER_MS = 560

/**
 * Holds the previous page on screen while it fades, then swaps and fades the
 * next one in, so navigation reads as one continuous surface instead of a
 * screen switch. Header, footer, and the guide never remount.
 */
export function RouteTransition({ children }: { children: (location: Location) => ReactNode }) {
  const location = useLocation()
  const [displayed, setDisplayed] = useState(location)
  // Start in "enter" so the first paint plays the same entrance as navigations.
  const [phase, setPhase] = useState<RoutePhase>("enter")

  useEffect(() => {
    if (location.key === displayed.key) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayed(location)
      setPhase("")
      return
    }
    setPhase("exit")
    const timer = window.setTimeout(() => {
      setDisplayed(location)
      setPhase("enter")
    }, EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [location, displayed.key])

  useEffect(() => {
    if (phase !== "enter") return
    const timer = window.setTimeout(() => setPhase(""), ENTER_MS)
    return () => window.clearTimeout(timer)
  }, [phase, displayed.key])

  // Jump to the top while the surface is fully faded, before paint.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [displayed.key])

  return (
    <RouteTransitionContext.Provider value={{ location: displayed, phase }}>
      {children(displayed)}
    </RouteTransitionContext.Provider>
  )
}
