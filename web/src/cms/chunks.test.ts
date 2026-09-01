import { describe, expect, it } from "vitest"
import { splitReplyIntoChunks, typingDelayFor } from "./chunks"
import {
  buildGreeting,
  buildGreetingEn,
  chinesePlace,
  detectMessageLang,
  englishPlace,
  replyLang,
  visitorLang,
} from "./greeting"

describe("splitReplyIntoChunks", () => {
  it("sends paragraphs as separate bubbles", () => {
    const reply = "第一段介绍。\n\n第二段用量。\n\n第三段反问？"
    expect(splitReplyIntoChunks(reply)).toEqual(["第一段介绍。", "第二段用量。", "第三段反问？"])
  })

  it("splits one long wall of text at sentence boundaries", () => {
    const reply = `${"皮纳图博火山灰适合水稻和茶叶，硅钾含量稳定，能改良酸化红壤并提高抗倒伏。".repeat(6)}您那边主要种什么？`
    const chunks = splitReplyIntoChunks(reply)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join("")).toContain("您那边主要种什么？")
  })

  it("keeps bullet lists together and caps the bubble count", () => {
    const reply = ["要点：\n- 一\n- 二", "甲。", "乙。", "丙。", "丁。", "戊。"].join("\n\n")
    const chunks = splitReplyIntoChunks(reply)
    expect(chunks.length).toBeLessThanOrEqual(4)
    expect(chunks[0]).toContain("- 二")
  })

  it("scales the typing pause with chunk length", () => {
    expect(typingDelayFor("短。")).toBeLessThan(typingDelayFor("这是一段明显更长的回复内容，用来验证输入时长。"))
    expect(typingDelayFor("超长".repeat(400))).toBeLessThanOrEqual(1500)
  })
})

describe("greeting", () => {
  it("maps China provinces and foreign countries into Chinese", () => {
    expect(chinesePlace("CN", "Jiangxi")).toBe("江西")
    expect(chinesePlace("CN", "unknown-region")).toBe("国内")
    expect(chinesePlace("PH", null)).toBe("菲律宾")
    expect(chinesePlace("", null)).toBeNull()
  })

  it("greets with the visitor location and stays salesy", () => {
    const greeting = buildGreeting("江西")
    expect(greeting).toContain("江西")
    expect(greeting).toContain("小林")
    expect(greeting).toContain("有什么我能帮您的")
    expect(splitReplyIntoChunks(greeting).length).toBe(3)
  })

  it("falls back to a generic opener without geo", () => {
    const greeting = buildGreeting(null)
    expect(greeting).toContain("皮纳图博火山灰")
    expect(greeting).not.toContain("访问")
  })

  it("routes Chinese regions to zh and everyone else to en", () => {
    expect(visitorLang("CN")).toBe("zh")
    expect(visitorLang("HK")).toBe("zh")
    expect(visitorLang("TW")).toBe("zh")
    expect(visitorLang("US")).toBe("en")
    expect(visitorLang("PH")).toBe("en")
    expect(visitorLang(null)).toBe("zh")
  })

  it("greets overseas visitors in English with their country", () => {
    expect(englishPlace("US")).toBe("United States")
    const greeting = buildGreetingEn("United States")
    expect(greeting).toContain("visiting from United States")
    expect(greeting).toContain("Pinatubo")
    expect(splitReplyIntoChunks(greeting).length).toBe(3)
  })

  it("the customer's own language beats the geo default", () => {
    expect(detectMessageLang("我们没什么产品")).toBe("zh")
    expect(detectMessageLang("How does it work?")).toBe("en")
    expect(detectMessageLang("50-100?")).toBeNull()
    expect(replyLang("en", "我们没什么产品")).toBe("zh")
    expect(replyLang("zh", "Do you ship to Manila?")).toBe("en")
    expect(replyLang("en", "50?")).toBe("en")
    expect(replyLang("zh", null)).toBe("zh")
  })
})
