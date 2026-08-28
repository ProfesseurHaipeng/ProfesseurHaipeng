import { MediaFrame } from "../components/MediaFrame"
import { PageIntro } from "../components/PageIntro"
import { useSiteContent } from "../cms/ContentContext"

export function MarketPage() {
  const { content } = useSiteContent()
  const page = content.market

  return (
    <article className="page">
      <PageIntro kicker={page.kicker} title={page.title} lead={page.lead} />
      <MediaFrame image={page.image} />
      {page.groups.map((group) => (
        <section className="stack" key={group.id}>
          <h2>{group.title}</h2>
          <div className="card-grid">
            {group.regions.map((region) => (
              <article className="card" key={region.id}>
                <h3>{region.name}</h3>
                <p>
                  <strong>土壤特点</strong> {region.soil}
                </p>
                <p>
                  <strong>推荐作物</strong> {region.crops}
                </p>
                <p>
                  <strong>应用方向</strong> {region.directions}
                </p>
              </article>
            ))}
          </div>
          {group.insight ? <p className="notice">{group.insight}</p> : null}
        </section>
      ))}
    </article>
  )
}
