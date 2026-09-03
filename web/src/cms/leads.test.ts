import { describe, expect, it } from "vitest"
import { newLeadId, sanitizeLead, sortLeads, type Lead } from "./leads"

describe("sanitizeLead", () => {
  it("keeps a normal submission", () => {
    expect(
      sanitizeLead({ name: " 王先生 ", org: "某农业集团", email: "wang@example.com", note: "江西水稻基地，先问样品。" }),
    ).toEqual({ name: "王先生", org: "某农业集团", email: "wang@example.com", note: "江西水稻基地，先问样品。" })
  })

  it("rejects submissions missing name, note, or a usable email", () => {
    expect(sanitizeLead({ name: "", email: "a@b.c", note: "x" })).toBeNull()
    expect(sanitizeLead({ name: "王", email: "not-an-email", note: "x" })).toBeNull()
    expect(sanitizeLead({ name: "王", email: "a@b.c", note: "  " })).toBeNull()
    expect(sanitizeLead(null)).toBeNull()
  })

  it("trims oversized fields instead of failing", () => {
    const lead = sanitizeLead({ name: "王", email: "a@b.c", note: "长".repeat(5000) })
    expect(lead?.note.length).toBe(2000)
  })
})

describe("lead ordering", () => {
  it("sorts newest first and ids sort with their timestamps", () => {
    const leads: Lead[] = [
      { id: "a", at: "2026-01-01T00:00:00Z", name: "旧", org: "", email: "a@b.c", note: "x" },
      { id: "b", at: "2026-02-01T00:00:00Z", name: "新", org: "", email: "a@b.c", note: "x" },
    ]
    expect(sortLeads(leads)[0]?.name).toBe("新")
    expect(newLeadId(1) < newLeadId(20)).toBe(true)
  })
})
