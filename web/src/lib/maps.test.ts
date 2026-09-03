import { describe, expect, it } from "vitest"
import { PINATUBO, googleMapsEmbedSrc, googleMapsOpenHref, osmEmbedSrc } from "./maps"

describe("Pinatubo map urls", () => {
  it("points Google Maps at Mount Pinatubo", () => {
    expect(googleMapsEmbedSrc()).toContain("output=embed")
    expect(googleMapsEmbedSrc()).toContain("Pinatubo")
    expect(googleMapsOpenHref()).toContain("google.com/maps")
    expect(googleMapsOpenHref()).toContain("Pinatubo")
  })

  it("keeps the OSM fallback around the same coordinates", () => {
    const src = osmEmbedSrc()
    expect(src).toContain("openstreetmap.org")
    expect(src).toContain(String(PINATUBO.lat))
    expect(src).toContain(String(PINATUBO.lng))
  })
})
