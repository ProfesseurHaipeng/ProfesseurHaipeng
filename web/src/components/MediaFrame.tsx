import type { MediaRef } from "../cms/types"

export function MediaFrame({
  image,
  className = "",
  caption,
}: {
  image: MediaRef
  className?: string
  caption?: string
}) {
  if (!image.src) return null
  return (
    <figure className={`media-frame ${className}`.trim()}>
      <img src={image.src} alt={image.alt} loading="lazy" />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}

