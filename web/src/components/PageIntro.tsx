import type { ReactNode } from "react"

type PageIntroProps = {
  kicker: string
  title: string
  lead?: string
  children?: ReactNode
}

export function PageIntro({ kicker, title, lead, children }: PageIntroProps) {
  return (
    <header className="page-hero">
      <p className="eyebrow">{kicker}</p>
      <h1>{title}</h1>
      {lead ? <p className="lede">{lead}</p> : null}
      {children}
    </header>
  )
}
