import { useState } from "react"
import type { MediaRef } from "../cms/types"
import { withBase } from "../lib/asset"

export type MediaRatio = "wide" | "portrait" | "square" | "auto"

export function MediaFrame({
  image,
  className = "",
  caption,
  ratio = "wide",
}: {
  image: MediaRef
  className?: string
  caption?: string
  ratio?: MediaRatio
}) {
  const [ready, setReady] = useState(false)
  if (!image.src) return null
  return (
    <figure className={`media-frame media-frame--${ratio} ${ready ? "is-ready" : ""} ${className}`.trim()}>
      <img
        src={withBase(image.src)}
        alt={image.alt}
        loading="lazy"
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
      />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}
