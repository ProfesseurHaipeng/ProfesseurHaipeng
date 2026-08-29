import { Link } from "react-router-dom"
import { MediaFrame } from "../components/MediaFrame"
import { PageHero } from "../components/PageHero"
import { SectionTabs } from "../components/SectionTabs"
import { useSiteContent } from "../cms/ContentContext"

export function ProjectPage() {
  const { content } = useSiteContent()
  const { overview, resource } = content

  return (
    <article className="page wrap">
      <PageHero kicker={overview.kicker} title={overview.title} lead={overview.intro[0]}>
        <p>{overview.intro[1]}</p>
      </PageHero>

      <SectionTabs
        tabs={[
          {
            id: "strategy",
            label: "战略",
            content: (
              <div className="stack">
                <ol className="timeline">
                  {overview.pillars.map((item, index) => (
                    <li key={item.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <h2>{item.title}</h2>
                        <p>{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="eyebrow">定位</p>
                <h2>{overview.strategyTitle}</h2>
                <p className="lede">{overview.strategyLead}</p>
                <ol className="layer-cards">
                  {overview.strategyLayers.map((item) => (
                    <li key={item.id}>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </li>
                  ))}
                </ol>
                <h2>{overview.valuesTitle}</h2>
                <MediaFrame image={overview.valuesImage} caption={overview.valuesImage.alt} />
                <div className="tile-grid tile-grid--2">
                  {overview.values.map((item) => (
                    <article key={item.id} className="tile">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
              </div>
            ),
          },
          {
            id: "resource",
            label: "资源",
            content: (
              <section className="resource-block">
                <div className="stack">
                  <p className="eyebrow">{resource.kicker}</p>
                  <h2>{resource.title}</h2>
                  <MediaFrame image={resource.image} caption={resource.image.alt} />
                  <h3>{resource.backgroundTitle}</h3>
                  {resource.background.map((para) => (
                    <p key={para}>{para}</p>
                  ))}
                  <h3>{resource.formationTitle}</h3>
                  <p>{resource.formationLead}</p>
                  <ol className="timeline">
                    {resource.formationSteps.map((step, index) => (
                      <li key={step.id}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <h3>{step.title}</h3>
                          <p>{step.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <p className="fine">{resource.formationNote}</p>
                  <MediaFrame image={resource.eruptionImage} caption={resource.eruptionImage.alt} />
                </div>
                <aside className="note-card">
                  <p className="eyebrow">{resource.traitsTitle}</p>
                  <ul className="plain-list">
                    {resource.traits.map((item) => (
                      <li key={item.id}>
                        <strong>{item.title}</strong>
                        <span>{item.body}</span>
                      </li>
                    ))}
                  </ul>
                  <Link className="text-link" to="/products?tab=assay">
                    看成分与产品 →
                  </Link>
                </aside>
              </section>
            ),
          },
          {
            id: "minerals",
            label: "矿物",
            content: (
              <section className="stack">
                <h2>{resource.mineralsTitle}</h2>
                <p className="lede">{resource.mineralsLead}</p>
                <div className="mineral-grid">
                  {resource.minerals.map((item) => (
                    <article key={item.id} className="mineral">
                      <span>{item.symbol}</span>
                      <h3>{item.name}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
                <Link className="text-link" to="/products?tab=assay">
                  看检测指标 →
                </Link>
              </section>
            ),
          },
        ]}
      />
    </article>
  )
}
