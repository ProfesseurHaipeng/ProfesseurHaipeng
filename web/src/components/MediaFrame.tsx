import type { MediaRef } from "../cms/types"

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
  if (!image.src) return null
  return (
    <figure className={`media-frame media-frame--${ratio} ${className}`.trim()}>
      <img src={image.src} alt={image.alt} loading="lazy" />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}
