import { CardGrid } from "../components/CardGrid"
import { MediaFrame } from "../components/MediaFrame"
import { PageIntro } from "../components/PageIntro"
import { useSiteContent } from "../cms/ContentContext"

export function SupplyPage() {
  const { content } = useSiteContent()
  const page = content.supply

  return (
    <article className="page">
      <PageIntro kicker={page.kicker} title={page.title} />
      <section className="split">
        <div className="stack">
          <h2>{page.mineTitle}</h2>
          <p className="measure">{page.mineBody}</p>
        </div>
        <div className="stack">
          <MediaFrame image={page.mineImage} />
          <div className="card-grid">
            {page.minePhotos.map((photo) => (
              <MediaFrame key={photo.id} image={photo} />
            ))}
          </div>
        </div>
      </section>
      <section className="split">
        <MediaFrame image={page.rawImage} />
        <div className="stack">
          <h2>{page.rawTitle}</h2>
          <CardGrid items={page.rawPoints} />
        </div>
      </section>
      <section className="stack">
        <h2>{page.processTitle}</h2>
        <ol className="layer-list">
          {page.process.map((step) => (
            <li key={step.id}>
              <strong>{step.title}</strong>
              <span>{step.body}</span>
            </li>
          ))}
        </ol>
        <p className="footnote">{page.processNote}</p>
      </section>
      <section className="split">
        <div className="stack">
          <h2>{page.shippingTitle}</h2>
          <CardGrid items={page.shipping} />
          <p className="footnote">{page.shippingNote}</p>
        </div>
        <MediaFrame image={page.shippingImage} />
      </section>
    </article>
  )
}
