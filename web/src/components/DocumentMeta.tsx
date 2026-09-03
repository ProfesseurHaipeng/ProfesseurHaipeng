import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useSiteContent } from "../cms/ContentContext"

const pageLabel: Record<string, string> = {
  "/": "",
  "/project": "项目",
  "/products": "产品",
  "/use": "应用",
  "/cases": "案例",
  "/contact": "联络",
  "/next": "待补",
}

export function DocumentMeta() {
  const { content } = useSiteContent()
  const { pathname } = useLocation()

  useEffect(() => {
    const name = content.settings.brandName || content.settings.productName
    const label = pageLabel[pathname] ?? ""
    document.title = label ? `${label} · ${name}` : name

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
  }, [content, pathname])

  return null
}
