import type { MediaRef } from "../cms/types"

export function MediaFrame({ image, className = "" }: { image: MediaRef; className?: string }) {
  if (!image.src) return null
  return (
    <figure className={`media-frame ${className}`.trim()}>
      <img src={image.src} alt={image.alt} />
    </figure>
  )
}
