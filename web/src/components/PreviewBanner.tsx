import { Link } from "react-router-dom"
import { useSiteContent } from "../cms/ContentContext"
import { setPreviewDraft } from "../cms/store"

export function PreviewBanner() {
  const { previewing } = useSiteContent()
  if (!previewing) return null

  return (
    <div className="preview-banner" role="status">
      <span>正在预览后台草稿，访客看不到这些改动。</span>
      <button
        type="button"
        onClick={() => {
          setPreviewDraft(false)
          window.location.href = window.location.pathname
        }}
      >
        退出预览
      </button>
      <Link to="/admin">回后台</Link>
    </div>
  )
}
