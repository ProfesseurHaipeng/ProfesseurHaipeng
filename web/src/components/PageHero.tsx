import type { ReactNode } from "react"

type PageHeroProps = {
  kicker: string
  title: string
  lead?: string
  children?: ReactNode
}

export function PageHero({ kicker, title, lead, children }: PageHeroProps) {
  return (
    <header className="page-hero">
      <p className="eyebrow">{kicker}</p>
      <h1>{title}</h1>
      {lead ? <p className="lede">{lead}</p> : null}
      {children}
    </header>
  )
}
