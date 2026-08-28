type PageIntroProps = {
  kicker: string
  title: string
  lead?: string
}

export function PageIntro({ kicker, title, lead }: PageIntroProps) {
  return (
    <header className="page-intro">
      <p className="latin-kicker">{kicker}</p>
      <h1>{title}</h1>
      {lead ? <p className="lead">{lead}</p> : null}
    </header>
  )
}
