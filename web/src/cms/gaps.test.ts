import { describe, expect, it } from "vitest"
import { cloneJson } from "./clone"
import { defaultContent } from "./defaultContent"
import { deriveGaps, emptyGapCount } from "./gaps"

describe("deriveGaps", () => {
  it("marks brand and contact channels empty on the handbook draft", () => {
    const gaps = deriveGaps(defaultContent)
    expect(gaps.find((gap) => gap.id === "brand")?.status).toBe("empty")
    expect(gaps.find((gap) => gap.id === "email")?.status).toBe("empty")
    expect(emptyGapCount(defaultContent)).toBeGreaterThan(0)
  })

  it("marks brand ready after a name is filled", () => {
    const next = cloneJson(defaultContent)
    next.settings.brandName = "灰原"
    next.settings.channels.email = "hello@example.com"
    const gaps = deriveGaps(next)
    expect(gaps.find((gap) => gap.id === "brand")?.status).toBe("ready")
    expect(gaps.find((gap) => gap.id === "email")?.status).toBe("ready")
  })
})
