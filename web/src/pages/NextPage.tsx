import { Link } from "react-router-dom"
import { PageIntro } from "../components/PageIntro"
import { useSiteContent } from "../cms/ContentContext"
import { deriveGaps } from "../cms/gaps"

const statusLabel = {
  empty: "空着",
  draft: "已有草稿",
  ready: "可定稿",
} as const

export function NextPage() {
  const { content } = useSiteContent()
  const live = deriveGaps(content)

  return (
    <article className="page">
      <PageIntro
        kicker="Supply later"
        title="还缺什么"
        lead="品牌可以后定。下面是根据当前文案自动标出来的空位，以及手册阶段留下的备忘。"
      />
      <ol className="field-list">
        {live.map((field, index) => (
          <li className="field-card" key={field.id}>
            <div className="field-card__top">
              <span className="field-card__n">{String(index + 1).padStart(2, "0")}</span>
              <span className={`status status--${field.status}`}>{statusLabel[field.status]}</span>
            </div>
            <h2>{field.label}</h2>
            <p>{field.why}</p>
            <p className="example">例如：{field.example}</p>
            <p className="value">{field.value || "（还没有内容）"}</p>
          </li>
        ))}
      </ol>
      {content.gaps.length > 0 ? (
        <section className="stack">
          <h2>备忘清单</h2>
          <ol className="field-list">
            {content.gaps.map((field) => (
              <li className="field-card" key={field.id}>
                <div className="field-card__top">
                  <span className={`status status--${field.status}`}>{statusLabel[field.status]}</span>
                </div>
                <h2>{field.label}</h2>
                <p>{field.why}</p>
                <p className="example">例如：{field.example}</p>
                <p className="value">{field.value || "（还没有内容）"}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <p>
        <Link className="btn" to="/admin">
          去后台补
        </Link>
      </p>
    </article>
  )
}
