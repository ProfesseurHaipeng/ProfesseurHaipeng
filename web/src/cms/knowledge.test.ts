import { describe, expect, it } from "vitest"
import { defaultContent } from "./defaultContent"
import { flattenKnowledge, isScopeRefusal, localGuideAnswer } from "./knowledge"

describe("site guide knowledge", () => {
  it("covers the six public pages and key product facts", () => {
    const brief = flattenKnowledge(defaultContent)
    expect(brief).toContain("/project")
    expect(brief).toContain("/products")
    expect(brief).toContain("水稻")
    expect(brief).toContain("500000")
    expect(brief).toContain("谷歌地图")
    expect(brief).toContain("15.14")
  })

  it("answers from the brief when no model is wired", () => {
    const brief = flattenKnowledge(defaultContent)
    const answer = localGuideAnswer("水稻怎么施用", brief)
    expect(answer).toContain("水稻")
    expect(answer).toMatch(/50-100|公斤|喜硅/)
  })

  it("introduces the volcanic ash when asked what the product is", () => {
    const brief = flattenKnowledge(defaultContent)
    const answer = localGuideAnswer("介绍一下产品", brief)
    expect(answer).toContain("皮纳图博火山灰")
    expect(answer).toContain("改土")
    expect(answer).not.toMatch(/服务范围/)
  })

  it("treats a fake out-of-scope reply as a refusal to replace", () => {
    expect(isScopeRefusal("这不在本项目顾问的服务范围内。我可以继续协助皮纳图博火山灰。")).toBe(true)
    expect(isScopeRefusal("水稻每亩 50-100 公斤，作基肥。")).toBe(false)
  })

  it("does not mention banned source language", () => {
    const brief = flattenKnowledge(defaultContent)
    const answer = localGuideAnswer("水稻怎么用", brief)
    expect(brief).not.toMatch(/招商/)
    expect(brief).not.toMatch(/独立试验/)
    expect(brief).not.toMatch(/独立站/)
    expect(JSON.stringify(defaultContent)).not.toMatch(/招商/)
    expect(JSON.stringify(defaultContent)).not.toMatch(/独立试验/)
    expect(JSON.stringify(defaultContent)).not.toMatch(/独立站/)
    expect(answer).not.toMatch(/招商/)
    expect(answer).not.toMatch(/独立/)
  })
})
