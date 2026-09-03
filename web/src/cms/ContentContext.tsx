import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { defaultContent } from "./defaultContent"
import {
  fetchPublished,
  isPreviewDraft,
  resolvePublicContent,
  setPreviewDraft,
  subscribeContent,
} from "./store"
import type { SiteContent } from "./types"

type ContentState = {
  content: SiteContent
  published: SiteContent
  previewing: boolean
  loading: boolean
}

const ContentContext = createContext<ContentState>({
  content: defaultContent,
  published: defaultContent,
  previewing: false,
  loading: true,
})

export function ContentProvider({ children }: { children: ReactNode }) {
  const [published, setPublished] = useState<SiteContent>(defaultContent)
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("preview") === "1") {
      setPreviewDraft(true)
    }
    let alive = true
    fetchPublished().then((doc) => {
      if (alive) {
        setPublished(doc)
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => subscribeContent(() => setTick((n) => n + 1)), [])

  const previewing = isPreviewDraft()
  const content = useMemo(() => {
    void tick
    void previewing
    return resolvePublicContent(published)
  }, [published, tick, previewing])

  return (
    <ContentContext.Provider value={{ content, published, previewing, loading }}>
      {children}
    </ContentContext.Provider>
  )
}

export function useSiteContent() {
  return useContext(ContentContext)
}
