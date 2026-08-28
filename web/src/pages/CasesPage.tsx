import { MediaFrame } from "../components/MediaFrame"
import { PageIntro } from "../components/PageIntro"
import { useSiteContent } from "../cms/ContentContext"

export function CasesPage() {
  const { content } = useSiteContent()
  const page = content.cases

  return (
    <article className="page">
      <PageIntro kicker={page.kicker} title={page.title} />
      <MediaFrame image={page.image} />
      {page.items.map((item) => (
        <section className="stack card" key={item.id}>
          <h2>{item.title}</h2>
          <p>{item.intro}</p>
          <p>
            <strong>案例背景</strong> {item.background}
          </p>
          <p>
            <strong>解决方案</strong> {item.solution}
          </p>
          <ul className="plain-list">
            {item.effects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
          <p className="footnote">{item.value}</p>
        </section>
      ))}
      <section className="stack">
        <h2>{page.compareTitle}</h2>
        <p className="measure">{page.compareLead}</p>
        <div className="compare">
          <article className="card">
            <h3>{page.beforeTitle}</h3>
            <ul className="plain-list">
              {page.before.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="card">
            <h3>{page.afterTitle}</h3>
            <ul className="plain-list">
              {page.after.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </article>
  )
}
