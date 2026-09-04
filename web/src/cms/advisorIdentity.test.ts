import { describe, expect, it } from "vitest"
import { advisorConversationIdentity } from "./advisorIdentity"

describe("advisor conversation identity", () => {
  it("signs a visitor seed instead of sending the raw id", () => {
    const id = advisorConversationIdentity("vis-abc", "secret")
    expect(id).toMatch(/^[0-9a-f]{64}$/)
    expect(id).not.toContain("vis-abc")
    expect(advisorConversationIdentity("vis-abc", "secret")).toBe(id)
    expect(advisorConversationIdentity("vis-other", "secret")).not.toBe(id)
    expect(advisorConversationIdentity("vis-abc", "other")).not.toBe(id)
  })

  it("falls back to a prefixed seed when no secret is configured", () => {
    expect(advisorConversationIdentity("vis-abc", "")).toBe("karmenai:vis-abc")
  })
})
