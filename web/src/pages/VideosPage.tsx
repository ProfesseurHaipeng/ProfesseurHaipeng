import { PageIntro } from "../components/PageIntro"
import { useSiteContent } from "../cms/ContentContext"

export function VideosPage() {
  const { content } = useSiteContent()
  const page = content.videos

  return (
    <article className="page">
      <PageIntro kicker={page.kicker} title={page.title} lead={page.lead} />
      <div className="card-grid">
        {page.items.map((item) => (
          <article className="card" key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            {item.url ? (
              <p>
                <a href={item.url} target="_blank" rel="noreferrer">
                  打开视频链接
                </a>
              </p>
            ) : (
              <p className="faint">链接还空着，可在后台补上。</p>
            )}
          </article>
        ))}
      </div>
      <p className="footnote">{page.note}</p>
    </article>
  )
}
