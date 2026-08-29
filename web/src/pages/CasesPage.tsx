import { Link } from "react-router-dom"
import { PageHero } from "../components/PageHero"
import { SplitPanel } from "../components/SplitPanel"
import { useSiteContent } from "../cms/ContentContext"

export function CasesPage() {
  const { content } = useSiteContent()
  const { cases, videos } = content

  return (
    <article className="page wrap">
      <PageHero kicker={cases.kicker} title={cases.title} lead={cases.compareLead} image={cases.image} />

      <section className="case-stack">
        {cases.items.map((item, index) => (
          <article key={item.id} className="case-detail">
            <SplitPanel image={item.image} caption={item.image.alt} ratio="portrait">
              <p className="eyebrow">{String(index + 1).padStart(2, "0")}</p>
              <h2>{item.title}</h2>
              <p className="lede">{item.intro}</p>
              <p>{item.background}</p>
              <p>
                <strong>做法：</strong>
                {item.solution}
              </p>
              <ul className="plain-list">
                {item.effects.map((effect) => (
                  <li key={effect}>{effect}</li>
                ))}
              </ul>
              <p className="fine">{item.value}</p>
            </SplitPanel>
          </article>
        ))}
      </section>

      <section className="compare">
        <SplitPanel image={content.products.soilImage} caption={content.products.soilImage.alt} ratio="wide">
          <p className="eyebrow">{cases.compareTitle}</p>
          <p className="lede">{cases.compareLead}</p>
        </SplitPanel>
        <div className="compare__cols">
          <div>
            <h3>{cases.beforeTitle}</h3>
            <ul className="plain-list">
              {cases.before.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>{cases.afterTitle}</h3>
            <ul className="plain-list">
              {cases.after.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="band band--inset">
        <p className="eyebrow">{videos.kicker}</p>
        <h2>{videos.title}</h2>
        <p className="lede">{videos.lead}</p>
        <ol className="video-list">
          {videos.items.map((item) => (
            <li key={item.id}>
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.title}
              </a>
              <span>{item.body}</span>
            </li>
          ))}
        </ol>
        <p className="fine">{videos.note}</p>
        <Link className="btn btn--ghost" to="/contact">
          问现场资料
        </Link>
      </section>
    </article>
  )
}
