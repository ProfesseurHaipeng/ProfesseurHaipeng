import { useSiteContent } from "../cms/ContentContext"

export function DraftMark() {
  const { content, previewing } = useSiteContent()
  return (
    <aside className="draft-mark" aria-label="站点状态">
      <span>{content.settings.brandStatus}</span>
      <span>{previewing ? "正在预览后台草稿" : "前台显示已发布内容"}</span>
    </aside>
  )
}
