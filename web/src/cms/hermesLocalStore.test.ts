import { describe, expect, it } from "vitest"
import { hydrateLocalHermesDesk, parseLocalHermesDesk, serializeLocalHermesDesk } from "./hermesLocalStore"

describe("local hermes desk file", () => {
  it("reloads deleted tickets and the ledger after a save", () => {
    const saved = serializeLocalHermesDesk({
      ...hydrateLocalHermesDesk(null),
      cases: [
        {
          id: "case-gone",
          at: "2026-09-03T12:00:00.000Z",
          updatedAt: "2026-09-03T12:05:00.000Z",
          name: "王先生",
          org: "",
          contact: "13900001111",
          note: "已删",
          owner: "hermes",
          following: false,
          progress: "talking",
          reaction: "",
          evaluation: "",
          energy: "unset",
          source: "ai",
          visitorId: "vis-talk",
          gone: true,
        },
      ],
      ledger: {
        goneIds: ["case-gone"],
        goneLeadIds: [],
        goneVisitorIds: ["vis-talk"],
        goneContacts: ["13900001111"],
        updatedAt: "2026-09-03T12:05:00.000Z",
      },
    })
    const raw = JSON.parse(saved) as { cases: { gone?: boolean }[] }
    expect(raw.cases[0]?.gone).toBe(true)
    const loaded = parseLocalHermesDesk(saved)
    expect(loaded.cases[0]?.id).toBe("case-gone")
    expect(loaded.cases[0]?.gone).toBe(true)
    expect(loaded.ledger.goneVisitorIds).toContain("vis-talk")
    expect(parseLocalHermesDesk("not-json").cases).toEqual([])
  })
})
