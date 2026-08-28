import { CardGrid } from "../components/CardGrid"
import { MediaFrame } from "../components/MediaFrame"
import { PageIntro } from "../components/PageIntro"
import { useSiteContent } from "../cms/ContentContext"

export function TestingPage() {
  const { content } = useSiteContent()
  const page = content.testing

  return (
    <article className="page">
      <PageIntro kicker={page.kicker} title={page.title} lead={page.intro} />
      <MediaFrame image={page.image} />
      <CardGrid items={page.layers} />
      <section className="stack">
        <h2>{page.docsTitle}</h2>
        <CardGrid items={page.docs} />
      </section>
      <section className="stack">
        <h2>{page.assayTitle}</h2>
        <p className="measure">{page.assayLead}</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>矿物</th>
                <th>符号</th>
                <th>含量（%）</th>
                <th>农业意义</th>
              </tr>
            </thead>
            <tbody>
              {page.assay.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.symbol}</td>
                  <td>{row.amount}</td>
                  <td>{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="footnote">{page.assayNote}</p>
      </section>
    </article>
  )
}
