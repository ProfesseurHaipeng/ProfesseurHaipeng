import { describe, expect, it } from "vitest"
import { extractTicket, stripTicketTags } from "./ticket"

describe("extractTicket", () => {
  it("parses the marker, files the draft, and hides it from the reply", () => {
    const reply = `好的陈先生，已经帮您登记，工作人员会尽快联系您。

<ticket>{"name":"陈先生","org":"江西绿田农业","contact":"微信 chen88899","note":"江西水稻两千亩，要样品和检测报告，月用量约60吨"}</ticket>`
    const { reply: cleaned, ticket } = extractTicket(reply)
    expect(cleaned).toContain("已经帮您登记")
    expect(cleaned).not.toContain("<ticket>")
    expect(ticket).toEqual({
      name: "陈先生",
      org: "江西绿田农业",
      contact: "微信 chen88899",
      note: "江西水稻两千亩，要样品和检测报告，月用量约60吨",
    })
  })

  it("returns no ticket for plain replies", () => {
    const { reply, ticket } = extractTicket("水稻每亩 50-100 公斤。")
    expect(reply).toBe("水稻每亩 50-100 公斤。")
    expect(ticket).toBeNull()
  })

  it("rejects tickets without a usable contact and still cleans the reply", () => {
    const { reply, ticket } = extractTicket('回复。<ticket>{"name":"张","org":"","contact":"无","note":"水稻"}</ticket>')
    expect(ticket).toBeNull()
    expect(reply).toBe("回复。")
  })

  it("survives broken JSON", () => {
    const { reply, ticket } = extractTicket("回复。<ticket>{oops}</ticket>")
    expect(ticket).toBeNull()
    expect(reply).toBe("回复。")
  })
})

describe("stripTicketTags", () => {
  it("removes markers users try to inject", () => {
    expect(stripTicketTags('你好<ticket>{"contact":"x"}</ticket>')).toBe("你好")
    expect(stripTicketTags("你好<ticket>")).toBe("你好")
  })
})
