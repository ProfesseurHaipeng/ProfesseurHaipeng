import { Link } from "react-router-dom"
import { CardGrid } from "../components/CardGrid"
import { MediaFrame } from "../components/MediaFrame"
import { useSiteContent } from "../cms/ContentContext"

export function HomePage() {
  const { content } = useSiteContent()
  const name = content.settings.brandName || content.settings.productName || content.hero.title

  return (
    <article className="page home">
      <section className="hero-split">
        <div className="hero-split__copy">
          <p className="latin-kicker">{content.hero.kicker}</p>
          <h1>{name}</h1>
          <p className="hero__lead">{content.hero.subtitle}</p>
          {content.hero.points.map((point) => (
            <p key={point} className="measure">
              {point}
            </p>
          ))}
          <div className="hero__actions">
            <Link className="btn" to={content.hero.primaryCta.href}>
              {content.hero.primaryCta.label}
            </Link>
            <Link className="btn btn--ghost" to={content.hero.secondaryCta.href}>
              {content.hero.secondaryCta.label}
            </Link>
          </div>
        </div>
        <MediaFrame image={content.hero.image} className="hero-split__media" />
      </section>

      <section className="stack">
        <h2>{content.overview.valuesTitle}</h2>
        <CardGrid items={content.overview.values} />
      </section>

      <section className="stat-row" aria-label="资料中的关键数字">
        {content.products.stats.map((stat) => (
          <article key={stat.id}>
            <p className="stat-row__value">{stat.value}</p>
            <h3>{stat.label}</h3>
            <p>{stat.body}</p>
          </article>
        ))}
      </section>

      <section className="split">
        <div>
          <p className="latin-kicker">继续阅读</p>
          <h2>手册九个部分都已进站</h2>
        </div>
        <ul className="link-list">
          {content.nav
            .filter((item) => item.href !== "/")
            .map((item) => (
              <li key={item.id}>
                <Link to={item.href}>{item.label}</Link>
              </li>
            ))}
        </ul>
      </section>
    </article>
  )
}
