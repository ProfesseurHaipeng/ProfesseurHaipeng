import { CardGrid } from "../components/CardGrid"
import { MediaFrame } from "../components/MediaFrame"
import { PageIntro } from "../components/PageIntro"
import { useSiteContent } from "../cms/ContentContext"

export function SolutionsPage() {
  const { content } = useSiteContent()
  const page = content.solutions

  return (
    <article className="page">
      <PageIntro kicker={page.kicker} title={page.title} lead={page.crops} />
      <MediaFrame image={page.image} />
      <div className="card-grid">
        {page.schemes.map((scheme) => (
          <article className="card" key={scheme.id}>
            <MediaFrame image={scheme.image} />
            <h3>{scheme.crop}</h3>
            <p>
              <strong>应用价值</strong> {scheme.value}
            </p>
            <p>
              <strong>推荐用量</strong> {scheme.dosage}
            </p>
            <p>
              <strong>使用方式</strong> {scheme.method}
            </p>
          </article>
        ))}
      </div>
      <section className="stack">
        <h2>{page.extrasTitle}</h2>
        <CardGrid items={page.extras} />
      </section>
      <section className="stack">
        <h2>{page.principlesTitle}</h2>
        <ul className="plain-list">
          {page.principles.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </article>
  )
}
