import { Link } from "react-router-dom"
import { TopoField } from "../components/TopoField"
import { useSiteContent } from "../cms/ContentContext"

export function HomePage() {
  const { content } = useSiteContent()
  const { hero, overview, products, solutions, cases, contact, settings } = content
  const crops = solutions.crops.split("·").map((item) => item.trim()).filter(Boolean)

  return (
    <article>
      <section className="hero">
        <div className="wrap hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">{hero.kicker}</p>
            <h1>{hero.title}</h1>
            <p className="lede">{hero.subtitle}</p>
            <ul className="hero__points">
              {hero.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="btn-row">
              <Link className="btn" to={hero.primaryCta.href}>
                {hero.primaryCta.label}
              </Link>
              <Link className="btn btn--ghost" to={hero.secondaryCta.href}>
                {hero.secondaryCta.label}
              </Link>
            </div>
          </div>
          <aside className="hero__visual" aria-hidden="true">
            <TopoField />
            <p className="hero__caption">矿带示意 · 不是手册照片</p>
          </aside>
        </div>
      </section>

      <section className="wrap stats" aria-label="手册中的核心数字">
        {products.stats.map((item) => (
          <div key={item.id} className="stat">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <em>{item.body}</em>
          </div>
        ))}
      </section>
      <p className="wrap fine">数字来自招商手册，以后台最新口径和检测报告为准。</p>

      <section className="wrap split">
        <div>
          <p className="eyebrow">{overview.kicker}</p>
          <h2>{overview.title}</h2>
          {overview.intro.map((para) => (
            <p key={para}>{para}</p>
          ))}
        </div>
        <ol className="timeline">
          {overview.pillars.map((item, index) => (
            <li key={item.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap">
        <div className="section-head">
          <div>
            <p className="eyebrow">产品</p>
            <h2>{products.directionsTitle}</h2>
          </div>
          <Link className="text-link" to="/products">
            全部产品 →
          </Link>
        </div>
        <div className="tile-grid">
          {products.directions.map((item) => (
            <article key={item.id} className="tile">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <p className="eyebrow">应用</p>
          <h2>先按作物看，不按手册页码看</h2>
          <p className="lede">{settings.audience}</p>
          <ul className="chip-row">
            {crops.map((crop) => (
              <li key={crop}>
                <Link to={`/use?crop=${encodeURIComponent(crop)}`}>{crop}</Link>
              </li>
            ))}
          </ul>
          <Link className="btn btn--ghost" to="/use">
            看应用方案
          </Link>
        </div>
      </section>

      <section className="wrap">
        <div className="section-head">
          <div>
            <p className="eyebrow">验证</p>
            <h2>手册里的两则案例</h2>
          </div>
          <Link className="text-link" to="/cases">
            全部案例 →
          </Link>
        </div>
        <div className="case-grid">
          {cases.items.slice(0, 2).map((item) => (
            <article key={item.id} className="case-card">
              <h3>{item.title}</h3>
              <p>{item.intro}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cta">
        <div className="wrap cta__grid">
          <div>
            <p className="eyebrow">下一步</p>
            <h2>{contact.title}</h2>
            <p>{contact.lead}</p>
          </div>
          <div className="btn-row">
            <Link className="btn" to="/contact">
              谈合作
            </Link>
            <Link className="btn btn--ghost" to="/project">
              先看项目
            </Link>
          </div>
        </div>
      </section>
    </article>
  )
}
