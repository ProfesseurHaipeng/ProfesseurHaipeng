import { useMemo, type ReactNode } from "react"
import { useSearchParams } from "react-router-dom"

export type SectionTab = {
  id: string
  label: string
  content: ReactNode
}

export function SectionTabs({ tabs, queryKey = "tab" }: { tabs: SectionTab[]; queryKey?: string }) {
  const [params, setParams] = useSearchParams()
  const current = useMemo(() => {
    const fromUrl = params.get(queryKey)
    return tabs.some((tab) => tab.id === fromUrl) ? fromUrl : tabs[0]?.id
  }, [params, queryKey, tabs])

  const active = tabs.find((tab) => tab.id === current) ?? tabs[0]
  if (!active) return null

  return (
    <div className="section-tabs">
      <div className="tabs" role="tablist" aria-label="本页分栏">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active.id}
            className={tab.id === active.id ? "chip chip--on" : "chip"}
            onClick={() => {
              const next = new URLSearchParams(params)
              next.set(queryKey, tab.id)
              setParams(next, { replace: true })
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel" key={active.id}>
        {active.content}
      </div>
    </div>
  )
}
