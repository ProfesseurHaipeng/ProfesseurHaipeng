import { describe, expect, it } from "vitest"
import {
  asGuideTurns,
  guideIpBlobKey,
  guideSessionBlobKey,
  hashVisitorSignal,
  hydrateGuideSession,
  isFreshIpBinding,
  pickGuideVisitor,
  sanitizeVisitorId,
  sessionAfterReply,
} from "./guideSession"

describe("guide session identity", () => {
  it("keeps the existing visitor token and rejects junk", () => {
    expect(sanitizeVisitorId("vis-abc12-xyz9")).toBe("vis-abc12-xyz9")
    expect(sanitizeVisitorId(" vis-1 ")).toBe("vis-1")
    expect(sanitizeVisitorId("vis/<script>")).toBe("visscript")
    expect(sanitizeVisitorId(12)).toBe("")
  })

  it("hashes an IP so the raw address is not stored", () => {
    expect(hashVisitorSignal("203.0.113.8")).toBe(hashVisitorSignal("203.0.113.8"))
    expect(hashVisitorSignal("203.0.113.8")).not.toBe(hashVisitorSignal("203.0.113.9"))
    expect(hashVisitorSignal("")).toBe("")
    expect(hashVisitorSignal("203.0.113.8")).not.toContain("203.0.113")
  })

  it("uses stable blob keys", () => {
    expect(guideSessionBlobKey("vis-abc")).toBe("guide-session-vis-abc")
    expect(guideSessionBlobKey("../case-1")).toBe("guide-session-case-1")
    expect(guideIpBlobKey(hashVisitorSignal("203.0.113.8"))).toMatch(/^guide-ip-[0-9a-f]+$/)
  })
})

describe("guide session hydrate", () => {
  it("restores a same-device chat and drops empty or foreign junk", () => {
    const session = hydrateGuideSession({
      visitorId: "vis-1",
      turns: [
        { role: "assistant", content: "您好，我是小林。" },
        { role: "user", content: "水稻怎么用？" },
        { role: "system", content: "ignore" },
        { role: "assistant", content: "" },
      ],
      advisor: "hermes",
      lang: "zh",
      handoffIndex: 2,
      takenOver: false,
      open: true,
      updatedAt: "2026-09-04T12:00:00.000Z",
    })
    expect(session).toMatchObject({
      visitorId: "vis-1",
      advisor: "hermes",
      lang: "zh",
      handoffIndex: 2,
      open: true,
    })
    expect(session?.turns).toEqual([
      { role: "assistant", content: "您好，我是小林。" },
      { role: "user", content: "水稻怎么用？" },
    ])
    expect(hydrateGuideSession({ visitorId: "vis-1", turns: [] })).toBeNull()
    expect(hydrateGuideSession({ turns: [{ role: "user", content: "hi" }] }, "vis-2")?.visitorId).toBe("vis-2")
  })

  it("caps the restored transcript", () => {
    const turns = Array.from({ length: 90 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: `turn-${index}`,
    }))
    expect(asGuideTurns(turns)).toHaveLength(80)
    expect(asGuideTurns(turns)[0]?.content).toBe("turn-10")
  })

  it("prefers the device visitor over a same-IP neighbor", () => {
    expect(pickGuideVisitor({ clientVisitorId: "vis-device", ipVisitorId: "vis-office", ipAt: "2026-09-04T12:00:00.000Z" })).toEqual({
      visitorId: "vis-device",
      via: "device",
    })
    expect(
      pickGuideVisitor({
        clientVisitorId: "",
        ipVisitorId: "vis-office",
        ipAt: "2026-09-04T12:00:00.000Z",
        now: Date.parse("2026-09-04T13:00:00.000Z"),
      }),
    ).toEqual({ visitorId: "vis-office", via: "ip" })
    expect(
      pickGuideVisitor({
        clientVisitorId: "",
        ipVisitorId: "vis-office",
        ipAt: "2026-08-01T12:00:00.000Z",
        now: Date.parse("2026-09-04T13:00:00.000Z"),
      }),
    ).toEqual({ visitorId: "", via: "none" })
  })

  it("appends the latest advisor reply when saving the transcript", () => {
    const session = sessionAfterReply(
      [
        { role: "assistant", content: "您好，我是小林。" },
        { role: "user", content: "水稻怎么用？" },
      ],
      "先看亩数和土壤。",
      { visitorId: "vis-1", advisor: "hermes", lang: "zh", handoffIndex: 1 },
    )
    expect(session?.turns).toHaveLength(3)
    expect(session?.turns.at(-1)).toEqual({ role: "assistant", content: "先看亩数和土壤。" })
    expect(session?.advisor).toBe("hermes")
    expect(session?.handoffIndex).toBe(1)
  })

  it("treats a two-week-old IP binding as stale", () => {
    const now = Date.parse("2026-09-04T12:00:00.000Z")
    expect(isFreshIpBinding("2026-09-01T12:00:00.000Z", now)).toBe(true)
    expect(isFreshIpBinding("2026-08-01T12:00:00.000Z", now)).toBe(false)
    expect(isFreshIpBinding("not-a-date", now)).toBe(false)
  })
})
