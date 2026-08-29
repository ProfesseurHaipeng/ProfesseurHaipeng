import { Link } from "react-router-dom"
import { MediaFrame } from "../components/MediaFrame"
import { TopoField } from "../components/TopoField"
import { useSiteContent } from "../cms/ContentContext"

export function HomePage() {
  const { content } = useSiteContent()
  const { hero, overview, products, solutions, cases, contact } = content
  const crops = solutions.crops.split("·").map((item) => item.trim()).filter(Boolean)
  const cropPhotos = solutions.schemes.filter((item) => ["rice", "banana", "tea"].includes(item.id))

  return (
    <article className="home">
      <section className="hero">
        <div className="wrap hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">{hero.kicker}</p>
            <h1>{hero.title}</h1>
            <p className="lede">{hero.subtitle}</p>
            <div className="btn-row">
              <Link className="btn" to={hero.primaryCta.href}>
                {hero.primaryCta.label}
              </Link>
              <Link className="btn btn--ghost" to={hero.secondaryCta.href}>
                {hero.secondaryCta.label}
              </Link>
            </div>
          </div>
          <div className="hero__visual">
            {hero.image.src ? (
              <MediaFrame image={hero.image} caption={hero.image.alt} />
            ) : (
              <>
                <TopoField />
                <p className="hero__caption">吕宋岛中西部 · 矿带示意</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="stats-band" aria-label="核心数字">
        <div className="wrap stats">
          {products.stats.map((item) => (
            <div key={item.id} className="stat">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <p className="wrap fine">数字来自招商手册，以最新检测和供应口径为准。</p>
      </section>

      <section className="block">
        <div className="wrap">
          <header className="block-head block-head--center">
            <p className="eyebrow">项目</p>
            <h2>{overview.title}</h2>
            <p className="lede">{overview.intro[0]}</p>
          </header>
          <div className="tile-grid">
            {overview.pillars.map((item) => (
              <article key={item.id} className="tile">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          <MediaFrame image={overview.craterImage} caption={overview.craterImage.alt} />
        </div>
      </section>

      <section className="block band">
        <div className="wrap">
          <header className="section-head">
            <div className="block-head">
              <p className="eyebrow">产品</p>
              <h2>{products.directionsTitle}</h2>
            </div>
            <Link className="text-link" to="/products">
              进一步了解 →
            </Link>
          </header>
          <div className="tile-grid">
            {products.directions.slice(0, 4).map((item) => (
              <Link key={item.id} className="tile tile--link" to="/products?tab=use">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <header className="block-head block-head--center">
            <p className="eyebrow">应用</p>
            <h2>先选作物</h2>
            <p className="lede">水稻、蕉果、茶柑和南方红壤是当前主谈方向。</p>
          </header>
          <ul className="chip-row">
            {crops.map((crop) => (
              <li key={crop}>
                <Link to={`/use?crop=${encodeURIComponent(crop)}`}>{crop}</Link>
              </li>
            ))}
          </ul>
          <div className="photo-strip">
            {cropPhotos.map((item) => (
              <MediaFrame key={item.id} image={item.image} caption={item.crop} />
            ))}
          </div>
          <p>
            <Link className="text-link" to="/use">
              看全部方案 →
            </Link>
          </p>
        </div>
      </section>

      <section className="block band">
        <div className="wrap">
          <header className="section-head">
            <div className="block-head">
              <p className="eyebrow">验证</p>
              <h2>两则案例</h2>
            </div>
            <Link className="text-link" to="/cases">
              进一步了解 →
            </Link>
          </header>
          <div className="case-grid">
            {cases.items.slice(0, 2).map((item) => (
              <Link key={item.id} className="case-card tile--link" to="/cases">
                <MediaFrame image={item.image} />
                <h3>{item.title}</h3>
                <p>{item.intro}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="wrap cta__grid">
          <div>
            <p className="eyebrow">下一步</p>
            <h2>拿样品谈，或留下作物和吨位</h2>
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
