import { useEffect } from "react"
import { useSiteContent } from "../cms/ContentContext"

export function DocumentMeta() {
  const { content } = useSiteContent()

  useEffect(() => {
    const name = content.settings.brandName || content.settings.productName
    document.title = `${name} · 内容草案`
    let robots = document.querySelector('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement("meta")
      robots.setAttribute("name", "robots")
      document.head.append(robots)
    }
    robots.setAttribute("content", content.settings.noIndex ? "noindex, nofollow" : "index, follow")

    let description = document.querySelector('meta[name="description"]')
    if (!description) {
      description = document.createElement("meta")
      description.setAttribute("name", "description")
      document.head.append(description)
    }
    description.setAttribute("content", content.settings.description)
  }, [content])

  return null
}
