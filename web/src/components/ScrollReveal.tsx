import { useLayoutEffect } from "react"
import { useRouteTransition } from "../lib/routeTransition"

const TARGETS = [
  ".block-head",
  ".tile",
  ".mineral",
  ".case-card",
  ".split-panel",
  ".stat",
  ".product-row",
  ".case-detail",
  ".callout",
  ".photo-strip__link",
  ".timeline li",
  ".layer-cards li",
  ".contact-card",
  ".assay",
  ".solution-card",
  ".cta__grid",
  ".compare__cols > div",
  ".video-list li",
].join(", ")

export function ScrollReveal() {
  const {
    location: { pathname },
  } = useRouteTransition()

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (!("IntersectionObserver" in window)) return

    const elements = Array.from(document.querySelectorAll<HTMLElement>(TARGETS)).filter(
      (el) => !el.classList.contains("is-in"),
    )
    const siblingIndex = new Map<Element | null, number>()
    for (const el of elements) {
      const parent = el.parentElement
      const index = siblingIndex.get(parent) ?? 0
      siblingIndex.set(parent, index + 1)
      el.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 55}ms`)
      el.classList.add("reveal")
    }

    const timers = new Set<number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          el.classList.add("is-in")
          observer.unobserve(el)
          // Hand transitions back to the element once the reveal has played.
          const timer = window.setTimeout(() => {
            el.classList.remove("reveal", "is-in")
            el.style.removeProperty("--reveal-delay")
            timers.delete(timer)
          }, 1000)
          timers.add(timer)
        }
      },
      { rootMargin: "0px 0px -7% 0px", threshold: 0.06 },
    )

    for (const el of elements) observer.observe(el)

    return () => {
      observer.disconnect()
      for (const timer of timers) window.clearTimeout(timer)
      for (const el of elements) {
        el.classList.remove("reveal", "is-in")
        el.style.removeProperty("--reveal-delay")
      }
    }
  }, [pathname])

  return null
}
