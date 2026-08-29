import { describe, expect, it } from "vitest"
import { defaultContent } from "./defaultContent"
import { mergeContent } from "./merge"

describe("mergeContent", () => {
  it("fills new schema fields when an old draft omits them", () => {
    const merged = mergeContent({
      schemaVersion: 1,
      settings: { brandName: "灰原", productName: "皮纳图博火山灰" },
      hero: { title: "灰原" },
    })
    expect(merged.settings.brandName).toBe("灰原")
    expect(merged.settings.channels.email).toBe("")
    expect(merged.settings.brochureUrl).toBe("")
    expect(merged.resource.eruptionImage).toHaveProperty("src")
    expect(merged.solutions.schemes[0]?.image).toHaveProperty("alt")
    expect(merged.nav.length).toBeGreaterThan(0)
  })

  it("keeps incoming list order and appends new default items by id", () => {
    const first = defaultContent.resource.minerals[0]
    const merged = mergeContent({
      schemaVersion: 1,
      resource: {
        minerals: [{ id: first.id, name: "改过的硅", symbol: first.symbol, body: first.body }],
      },
    })
    expect(merged.resource.minerals[0]?.name).toBe("改过的硅")
    expect(merged.resource.minerals.length).toBe(defaultContent.resource.minerals.length)
  })

  it("keeps default media when a published draft leaves src empty", () => {
    const merged = mergeContent({
      schemaVersion: 1,
      hero: { image: { src: "", alt: "" } },
    })
    expect(merged.hero.image.src).toBe(defaultContent.hero.image.src)
    expect(merged.hero.image.src.length).toBeGreaterThan(0)
  })

  it("lets a boolean false overwrite the default", () => {
    const merged = mergeContent({
      schemaVersion: 1,
      settings: { noIndex: false },
    })
    expect(merged.settings.noIndex).toBe(false)
  })

  it("strips source-disclaimer language from an old published draft", () => {
    const merged = mergeContent({
      schemaVersion: 1,
      cases: {
        compareLead: "效果数字来自招商资料，不是本站独立试验。有原件后再把口径改硬。",
      },
    })
    expect(merged.cases.compareLead).not.toMatch(/招商/)
    expect(merged.cases.compareLead).not.toMatch(/独立试验/)
    expect(merged.cases.compareLead).not.toMatch(/独立站/)
  })
})
