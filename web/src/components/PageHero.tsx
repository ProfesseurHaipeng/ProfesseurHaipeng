import type { ReactNode } from "react"
import type { MediaRef } from "../cms/types"
import { MediaFrame, type MediaRatio } from "./MediaFrame"

type PageHeroProps = {
  kicker: string
  title: string
  lead?: string
  image?: MediaRef
  ratio?: MediaRatio
  children?: ReactNode
}

export function PageHero({ kicker, title, lead, image, ratio = "portrait", children }: PageHeroProps) {
  const copy = (
    <>
      <p className="eyebrow">{kicker}</p>
      <h1>{title}</h1>
      {lead ? <p className="lede">{lead}</p> : null}
      {children}
    </>
  )

  if (image?.src) {
    return (
      <header className="page-hero page-hero--split">
        <MediaFrame image={image} ratio={ratio} />
        <div className="page-hero__copy">{copy}</div>
      </header>
    )
  }

  return <header className="page-hero">{copy}</header>
}
