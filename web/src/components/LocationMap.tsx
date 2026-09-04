import { useEffect, useRef, useState } from "react"
import { PINATUBO, googleMapsEmbedSrc, googleMapsOpenHref, osmEmbedSrc } from "../lib/maps"

const GOOGLE_WAIT_MS = 4000

export function LocationMap({ caption = PINATUBO.caption }: { caption?: string }) {
  const [source, setSource] = useState<"google" | "osm">("google")
  const googleLoaded = useRef(false)

  useEffect(() => {
    if (source !== "google") return
    const id = window.setTimeout(() => {
      if (!googleLoaded.current) setSource("osm")
    }, GOOGLE_WAIT_MS)
    return () => window.clearTimeout(id)
  }, [source])

  const src = source === "google" ? googleMapsEmbedSrc() : osmEmbedSrc()

  return (
    <figure className="location-map">
      <div className="location-map__frame">
        <iframe
          key={source}
          title="皮纳图博火山在吕宋岛中西部的位置"
          src={src}
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          onLoad={() => {
            if (source === "google") googleLoaded.current = true
          }}
        />
      </div>
      <figcaption>
        {caption}
        <a className="location-map__open" href={googleMapsOpenHref()} target="_blank" rel="noreferrer">
          在谷歌地图打开
        </a>
      </figcaption>
    </figure>
  )
}
