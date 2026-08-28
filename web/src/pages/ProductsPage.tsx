import { CardGrid } from "../components/CardGrid"
import { MediaFrame } from "../components/MediaFrame"
import { PageIntro } from "../components/PageIntro"
import { useSiteContent } from "../cms/ContentContext"

export function ProductsPage() {
  const { content } = useSiteContent()
  const page = content.products

  return (
    <article className="page">
      <PageIntro kicker={page.kicker} title={page.title} />
      <section className="split">
        <div className="stack">
          <h2>{page.sourceTitle}</h2>
          {page.source.map((p) => (
            <p key={p} className="measure">
              {p}
            </p>
          ))}
        </div>
        <MediaFrame image={page.warehouseImage} />
      </section>
      <section className="stat-row">
        {page.stats.map((stat) => (
          <article key={stat.id}>
            <p className="stat-row__value">{stat.value}</p>
            <h3>{stat.label}</h3>
            <p>{stat.body}</p>
          </article>
        ))}
      </section>
      <section className="stack">
        <h2>{page.directionsTitle}</h2>
        <CardGrid items={page.directions} />
      </section>
      <section className="split">
        <MediaFrame image={page.soilImage} />
        <div className="stack">
          <h2>{page.soilTitle}</h2>
          <CardGrid items={page.soil} />
        </div>
      </section>
      <section className="stack">
        <h2>{page.fertilizerTitle}</h2>
        <p className="measure">{page.fertilizerLead}</p>
        <CardGrid items={page.fertilizer} />
      </section>
      <section className="split">
        <div className="stack">
          <h2>{page.livestockTitle}</h2>
          <CardGrid items={page.livestock} />
        </div>
        <MediaFrame image={page.livestockImage} />
      </section>
      <section className="stack">
        <h2>{page.otherTitle}</h2>
        <CardGrid items={page.other} />
      </section>
      <section className="stack">
        <h2>{page.packTitle}</h2>
        <CardGrid items={page.packs} />
      </section>
      <section className="stack">
        <h2>{page.capacityTitle}</h2>
        <CardGrid items={page.capacity} />
        <h3>{page.customersTitle}</h3>
        <ul className="plain-list">
          {page.customers.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </article>
  )
}
