import type { TextBlock } from "../cms/types"

export function CardGrid({ items, className = "" }: { items: TextBlock[]; className?: string }) {
  return (
    <div className={`card-grid ${className}`.trim()}>
      {items.map((item) => (
        <article className="card" key={item.id}>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  )
}
