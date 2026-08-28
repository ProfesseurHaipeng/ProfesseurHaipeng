import { CardGrid } from "../components/CardGrid"
import { MediaFrame } from "../components/MediaFrame"
import { PageIntro } from "../components/PageIntro"
import { useSiteContent } from "../cms/ContentContext"

export function ProjectPage() {
  const { content } = useSiteContent()
  const page = content.overview

  return (
    <article className="page">
      <PageIntro kicker={page.kicker} title={page.title} lead={content.settings.projectName} />
      <section className="stack">
        {page.intro.map((p) => (
          <p key={p} className="measure">
            {p}
          </p>
        ))}
      </section>
      <CardGrid items={page.pillars} />
      <section className="stack">
        <h2>{page.strategyTitle}</h2>
        <p className="measure">{page.strategyLead}</p>
        <ol className="layer-list">
          {page.strategyLayers.map((layer) => (
            <li key={layer.id}>
              <strong>{layer.title}</strong>
              <span>{layer.body}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="split">
        <MediaFrame image={page.valuesImage} />
        <div className="stack">
          <h2>{page.valuesTitle}</h2>
          <CardGrid items={page.values} />
        </div>
      </section>
    </article>
  )
}
