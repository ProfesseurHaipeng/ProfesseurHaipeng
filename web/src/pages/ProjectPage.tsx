import { Link } from "react-router-dom"
import { PageHero } from "../components/PageHero"
import { useSiteContent } from "../cms/ContentContext"

export function ProjectPage() {
  const { content } = useSiteContent()
  const { overview, resource } = content

  return (
    <article className="page wrap">
      <PageHero kicker={overview.kicker} title={overview.title} lead={overview.intro[0]}>
        <p>{overview.intro[1]}</p>
      </PageHero>

      <nav className="page-jump" aria-label="本页目录">
        <a href="#pillars">两端</a>
        <a href="#strategy">战略</a>
        <a href="#values">价值</a>
        <a href="#resource">资源</a>
      </nav>

      <section id="pillars">
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
      </section>

      <section id="strategy" className="stack">
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
      </section>

      <section id="values" className="stack">
        <p className="eyebrow">价值</p>
        <h2>{overview.valuesTitle}</h2>
        <div className="tile-grid tile-grid--2">
          {overview.values.map((item) => (
            <article key={item.id} className="tile">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="resource" className="resource-block">
        <div className="stack">
          <p className="eyebrow">{resource.kicker}</p>
          <h2>{resource.title}</h2>
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
        </div>
        <aside className="note-card">
          <p className="eyebrow">这一页怎么读</p>
          <p>
            手册里的火山口和喷发照片只作内部参考，公网站用文字说明资源从哪来、矿物为什么和改土有关。
          </p>
          <h3>{resource.traitsTitle}</h3>
          <ul className="plain-list">
            {resource.traits.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </li>
            ))}
          </ul>
          <Link className="text-link" to="/products">
            看成分与产品 →
          </Link>
        </aside>
      </section>

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
      </section>
    </article>
  )
}
