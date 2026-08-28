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

  it("lets a boolean false overwrite the default", () => {
    const merged = mergeContent({
      schemaVersion: 1,
      settings: { noIndex: false },
    })
    expect(merged.settings.noIndex).toBe(false)
  })
})
