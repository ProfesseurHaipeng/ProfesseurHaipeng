import { Link } from "react-router-dom"
import { MediaFrame } from "../components/MediaFrame"
import { PageHero } from "../components/PageHero"
import { useSiteContent } from "../cms/ContentContext"

export function CasesPage() {
  const { content } = useSiteContent()
  const { cases, videos } = content

  return (
    <article className="page wrap">
      <PageHero
        kicker={cases.kicker}
        title={cases.title}
        lead={cases.compareLead}
      />

      <section className="case-stack">
        {cases.items.map((item, index) => (
          <article key={item.id} className="case-detail">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div className="stack">
              <h2>{item.title}</h2>
              <MediaFrame image={item.image} caption={item.image.alt} />
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
            </div>
          </article>
        ))}
      </section>

      <section className="compare">
        <div>
          <p className="eyebrow">{cases.compareTitle}</p>
          <p className="lede">{cases.compareLead}</p>
        </div>
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
