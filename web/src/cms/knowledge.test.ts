import { describe, expect, it } from "vitest"
import { defaultContent } from "./defaultContent"
import { flattenKnowledge, localGuideAnswer } from "./knowledge"

describe("site guide knowledge", () => {
  it("covers the six public pages and key product facts", () => {
    const brief = flattenKnowledge(defaultContent)
    expect(brief).toContain("/project")
    expect(brief).toContain("/products")
    expect(brief).toContain("水稻")
    expect(brief).toContain("500000")
  })

  it("answers from the brief when no model is wired", () => {
    const brief = flattenKnowledge(defaultContent)
    const answer = localGuideAnswer("水稻怎么施用", brief)
    expect(answer).toContain("水稻")
    expect(answer).toMatch(/50-100|公斤|喜硅/)
  })

  it("does not mention banned source language", () => {
    const brief = flattenKnowledge(defaultContent)
    expect(brief).not.toMatch(/招商/)
    expect(brief).not.toMatch(/独立试验/)
    expect(brief).not.toMatch(/独立站/)
    expect(JSON.stringify(defaultContent)).not.toMatch(/招商/)
    expect(JSON.stringify(defaultContent)).not.toMatch(/独立试验/)
  })
})
