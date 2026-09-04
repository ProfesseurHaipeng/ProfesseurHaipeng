import { Link } from "react-router-dom"
import { MediaFrame } from "../components/MediaFrame"
import { PageHero } from "../components/PageHero"
import { SectionTabs } from "../components/SectionTabs"
import { SplitPanel } from "../components/SplitPanel"
import { useSiteContent } from "../cms/ContentContext"

function barWidth(amount: string) {
  const value = Number.parseFloat(amount)
  if (!Number.isFinite(value)) return "8%"
  return `${Math.min(100, Math.max(8, (value / 60) * 100))}%`
}

export function ProductsPage() {
  const { content } = useSiteContent()
  const { products, testing, supply } = content

  return (
    <article className="page wrap">
      <PageHero kicker={products.kicker} title={products.title} lead={products.source[0]}>
        <p>{products.source[1]}</p>
      </PageHero>
      <MediaFrame image={products.warehouseImage} caption={products.warehouseImage.alt} ratio="wide" />

      <section className="stats" aria-label="产品数字">
        {products.stats.map((item) => (
          <div key={item.id} className="stat">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <em>{item.body}</em>
          </div>
        ))}
      </section>

      <SectionTabs
        tabs={[
          {
            id: "use",
            label: "方向",
            content: (
              <section className="stack">
                <h2>{products.directionsTitle}</h2>
                <div className="tile-grid">
                  {products.directions.map((item) => (
                    <article key={item.id} className="tile">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
              </section>
            ),
          },
          {
            id: "soil",
            label: "改土",
            content: (
              <section className="stack">
                <SplitPanel image={products.soilImage} caption={products.soilImage.alt} ratio="wide">
                  <h2>{products.soilTitle}</h2>
                  <div className="tile-grid tile-grid--2">
                    {products.soil.map((item) => (
                      <article key={item.id} className="tile">
                        <h3>{item.title}</h3>
                        <p>{item.body}</p>
                      </article>
                    ))}
                  </div>
                </SplitPanel>
                <h2>{products.fertilizerTitle}</h2>
                <p className="lede">{products.fertilizerLead}</p>
                <div className="tile-grid tile-grid--2">
                  {products.fertilizer.map((item) => (
                    <article key={item.id} className="tile">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
                <SplitPanel image={products.livestockImage} caption={products.livestockImage.alt} ratio="portrait">
                  <h2>{products.livestockTitle}</h2>
                </SplitPanel>
                <div className="tile-grid tile-grid--2">
                  {products.livestock.map((item) => (
                    <article key={item.id} className="tile">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
                <h2>{products.otherTitle}</h2>
                <div className="tile-grid">
                  {products.other.map((item) => (
                    <article key={item.id} className="tile">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
              </section>
            ),
          },
          {
            id: "assay",
            label: "检测",
            content: (
              <section className="two-col">
                <div className="stack">
                  <p className="eyebrow">{testing.kicker}</p>
                  <h2>{testing.assayTitle}</h2>
                  <MediaFrame image={testing.image} caption={testing.image.alt} ratio="wide" />
                  <p className="lede">{testing.assayLead}</p>
                  <p>{testing.intro}</p>
                  <ul className="plain-list">
                    {testing.layers.map((item) => (
                      <li key={item.id}>
                        <strong>{item.title}</strong>
                        <span>{item.body}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="assay">
                  <p className="eyebrow">主要氧化物</p>
                  <ul className="assay-bars">
                    {testing.assay.map((row) => (
                      <li key={row.id}>
                        <div className="assay-bars__meta">
                          <span>{row.symbol}</span>
                          <strong>{row.amount}%</strong>
                        </div>
                        <div className="bar" aria-hidden="true">
                          <i style={{ width: barWidth(row.amount) }} />
                        </div>
                        <em>
                          {row.name} · {row.meaning}
                        </em>
                      </li>
                    ))}
                  </ul>
                  <p className="fine">{testing.assayNote}</p>
                </div>
              </section>
            ),
          },
          {
            id: "supply",
            label: "供应",
            content: (
              <section className="stack">
                <p className="eyebrow">{supply.kicker}</p>
                <h2>{supply.title}</h2>
                <SplitPanel image={supply.mineImage} caption={supply.mineImage.alt} ratio="portrait">
                  <h3>{supply.mineTitle}</h3>
                  <p>{supply.mineBody}</p>
                </SplitPanel>
                <SplitPanel image={supply.rawImage} caption={supply.rawImage.alt} ratio="portrait">
                  <h3>{supply.rawTitle}</h3>
                </SplitPanel>
                <div className="tile-grid tile-grid--2">
                  {supply.rawPoints.map((item) => (
                    <article key={item.id} className="tile">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
                <h3>{supply.processTitle}</h3>
                <p className="fine">{supply.processNote}</p>
                <ol className="timeline">
                  {supply.process.map((step, index) => (
                    <li key={step.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <h3>{supply.shippingTitle}</h3>
                <MediaFrame image={supply.shippingImage} caption={supply.shippingImage.alt} ratio="wide" />
                <div className="tile-grid">
                  {supply.shipping.map((item) => (
                    <article key={item.id} className="tile">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
                <p className="fine">{supply.shippingNote}</p>
              </section>
            ),
          },
          {
            id: "pack",
            label: "包装",
            content: (
              <section className="stack">
                <h2>{products.packTitle}</h2>
                <div className="tile-grid tile-grid--2">
                  {products.packs.map((item) => (
                    <article key={item.id} className="tile">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
                <h2>{products.capacityTitle}</h2>
                <div className="tile-grid">
                  {products.capacity.map((item) => (
                    <article key={item.id} className="tile">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
                <h2>{products.customersTitle}</h2>
                <ul className="chip-row chip-row--static">
                  {products.customers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link className="btn" to="/contact">
                  问供应与样品
                </Link>
              </section>
            ),
          },
        ]}
      />
    </article>
  )
}
