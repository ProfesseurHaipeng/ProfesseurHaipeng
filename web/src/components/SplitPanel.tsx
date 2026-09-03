import type { ReactNode } from "react"
import type { MediaRef } from "../cms/types"
import { MediaFrame, type MediaRatio } from "./MediaFrame"

export function SplitPanel({
  image,
  caption,
  ratio = "portrait",
  reverse = false,
  className = "",
  children,
}: {
  image: MediaRef
  caption?: string
  ratio?: MediaRatio
  reverse?: boolean
  className?: string
  children: ReactNode
}) {
  if (!image.src) {
    return <div className={`split-panel__copy ${className}`.trim()}>{children}</div>
  }

  return (
    <div className={`split-panel ${reverse ? "split-panel--reverse" : ""} ${className}`.trim()}>
      <MediaFrame image={image} caption={caption} ratio={ratio} />
      <div className="split-panel__copy">{children}</div>
    </div>
  )
}
