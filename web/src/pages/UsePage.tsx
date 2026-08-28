import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { PageHero } from "../components/PageHero"
import { useSiteContent } from "../cms/ContentContext"

export function UsePage() {
  const { content } = useSiteContent()
  const { market, solutions } = content
  const [params, setParams] = useSearchParams()
  const cropFromUrl = params.get("crop") ?? "全部"
  const [crop, setCrop] = useState(cropFromUrl)

  useEffect(() => {
    setCrop(cropFromUrl)
  }, [cropFromUrl])

  const selectCrop = (name: string) => {
    setCrop(name)
    const next = new URLSearchParams(params)
    if (name === "全部") next.delete("crop")
    else next.set("crop", name)
    setParams(next, { replace: true })
  }

  const cropNames = useMemo(() => {
    const fromLine = solutions.crops.split("·").map((item) => item.trim()).filter(Boolean)
    return ["全部", ...fromLine]
  }, [solutions.crops])

  const schemes = useMemo(() => {
    if (crop === "全部") return solutions.schemes
    if (crop === "经济作物") return []
    return solutions.schemes.filter((item) => item.crop === crop || item.value.includes(crop))
  }, [crop, solutions.schemes])

  const extras = useMemo(() => {
    if (crop === "全部" || crop === "经济作物") return solutions.extras
    return solutions.extras.filter((item) => item.title.includes(crop) || item.body.includes(crop))
  }, [crop, solutions.extras])

  const regions = useMemo(() => {
    if (crop === "全部") return market.groups
    return market.groups
      .map((group) => ({
        ...group,
        regions: group.regions.filter(
          (region) => region.crops.includes(crop) || region.directions.includes(crop),
        ),
      }))
      .filter((group) => group.regions.length > 0)
  }, [crop, market.groups])

  return (
    <article className="page wrap">
      <PageHero kicker={solutions.kicker} title={solutions.title} lead={solutions.crops} />

      <section className="band band--inset">
        <p className="eyebrow">{market.kicker}</p>
        <h2>{market.title}</h2>
        <p className="lede">{market.lead}</p>
      </section>

      <section>
        <div className="section-head">
          <h2>按作物看方案</h2>
          <p className="fine">点作物名过滤方案和对应省份。</p>
        </div>
        <div className="filter-row" role="tablist" aria-label="作物筛选">
          {cropNames.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={crop === name}
              className={crop === name ? "chip chip--on" : "chip"}
              onClick={() => selectCrop(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="solution-list">
          {schemes.map((item) => (
            <article key={item.id} className="solution-card">
              <p className="eyebrow">{item.crop}</p>
              <h3>{item.crop}方案</h3>
              <p>{item.value}</p>
              <dl className="meta-dl">
                <div>
                  <dt>用量</dt>
                  <dd>{item.dosage}</dd>
                </div>
                <div>
                  <dt>方法</dt>
                  <dd>{item.method}</dd>
                </div>
              </dl>
            </article>
          ))}
          {extras.map((item) => (
            <article key={item.id} className="solution-card">
              <p className="eyebrow">其他作物</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
          {schemes.length === 0 && extras.length === 0 ? (
            <p className="fine">这一作物还没有单独方案，先看全部或联络我们补。</p>
          ) : null}
        </div>
      </section>

      <section className="stack">
        <h2>
          {crop === "全部" ? "南方重点区域" : `${crop}相关区域`}
        </h2>
        {regions.length === 0 ? (
          <p className="fine">这一作物没有单独标到省份，区域说明仍可在「全部」里看。</p>
        ) : (
          regions.map((group) => (
            <div key={group.id} className="region-group">
              <h3>{group.title}</h3>
              {group.insight ? <p className="fine">{group.insight}</p> : null}
              <div className="tile-grid">
                {group.regions.map((region) => (
                  <article key={region.id} className="tile">
                    <h3>{region.name}</h3>
                    <p>{region.soil}</p>
                    <p className="fine">作物：{region.crops}</p>
                    <p className="fine">方向：{region.directions}</p>
                  </article>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="stack">
        <h2>{solutions.principlesTitle}</h2>
        <ol className="plain-list">
          {solutions.principles.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <Link className="text-link" to="/cases">
          看验证案例 →
        </Link>
      </section>
    </article>
  )
}
