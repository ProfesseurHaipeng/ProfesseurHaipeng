import { CardGrid } from "../components/CardGrid"
import { MediaFrame } from "../components/MediaFrame"
import { PageIntro } from "../components/PageIntro"
import { useSiteContent } from "../cms/ContentContext"

export function ResourcePage() {
  const { content } = useSiteContent()
  const page = content.resource

  return (
    <article className="page">
      <PageIntro kicker={page.kicker} title={page.title} />
      <section className="split">
        <div className="stack">
          <h2>{page.backgroundTitle}</h2>
          {page.background.map((p) => (
            <p key={p} className="measure">
              {p}
            </p>
          ))}
        </div>
        <div className="stack">
          <MediaFrame image={page.image} />
          <MediaFrame image={page.eruptionImage} />
        </div>
      </section>
      <section className="stack">
        <h2>{page.formationTitle}</h2>
        <p className="measure">{page.formationLead}</p>
        <ol className="layer-list">
          {page.formationSteps.map((step) => (
            <li key={step.id}>
              <strong>{step.title}</strong>
              <span>{step.body}</span>
            </li>
          ))}
        </ol>
        <p className="footnote">{page.formationNote}</p>
      </section>
      <section className="stack">
        <h2>{page.traitsTitle}</h2>
        <CardGrid items={page.traits} />
      </section>
      <section className="stack">
        <h2>{page.mineralsTitle}</h2>
        <p className="measure">{page.mineralsLead}</p>
        <div className="card-grid card-grid--4">
          {page.minerals.map((mineral) => (
            <article className="card" key={mineral.id}>
              <p className="latin-kicker">
                {mineral.symbol} · {mineral.name}
              </p>
              <p>{mineral.body}</p>
            </article>
          ))}
        </div>
      </section>
    </article>
  )
}
