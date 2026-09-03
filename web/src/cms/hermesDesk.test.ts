import { describe, expect, it } from "vitest"
import {
  applyResume,
  applyTakeover,
  buildCoachMessages,
  caseFromLead,
  deskStats,
  extractDeskUpdates,
  filterHermesCases,
  findHermesCase,
  importLeads,
  isHumanOwned,
  upsertFromTicket,
  upsertFromVisit,
  type HermesCase,
} from "./hermesDesk"
import type { Lead } from "./leads"

const now = "2026-09-03T12:00:00.000Z"

function sample(partial: Partial<HermesCase> = {}): HermesCase {
  return {
    id: "case-1",
    at: now,
    updatedAt: now,
    name: "王先生",
    org: "某农业集团",
    contact: "13800000000",
    note: "江西水稻，先问样品",
    owner: "hermes",
    following: true,
    progress: "talking",
    reaction: "要样品",
    evaluation: "值得跟",
    energy: "high",
    source: "ai",
    ...partial,
  }
}

describe("hermes desk cases", () => {
  it("filters following, human takeover, and high energy", () => {
    const cases = [
      sample(),
      sample({ id: "case-2", following: false, energy: "low", name: "李" }),
      sample({ id: "case-3", owner: "human", following: false, name: "周" }),
    ]
    expect(filterHermesCases(cases, { follow: "following" })).toHaveLength(1)
    expect(filterHermesCases(cases, { owner: "human" })[0]?.id).toBe("case-3")
    expect(filterHermesCases(cases, { energy: "high" })[0]?.name).toBe("王先生")
    expect(filterHermesCases(cases, { query: "水稻" })[0]?.id).toBe("case-1")
    expect(deskStats(cases)).toMatchObject({ following: 1, idle: 1, human: 1, high: 2, low: 1 })
  })

  it("takes a case off Hermes and can hand it back", () => {
    const taken = applyTakeover(sample())
    expect(taken.owner).toBe("human")
    expect(taken.following).toBe(false)
    const back = applyResume(taken)
    expect(back.owner).toBe("hermes")
    expect(back.following).toBe(true)
  })

  it("upserts a visitor and a ticket onto the same case", () => {
    const first = upsertFromVisit([], "vis-1", "问了水稻用量", now)
    const second = upsertFromTicket(
      first.cases,
      { name: "王先生", org: "某集团", contact: "13800000000", note: "江西水稻 200 亩" },
      { visitorId: "vis-1" },
      now,
    )
    expect(second.cases).toHaveLength(1)
    expect(second.case.name).toBe("王先生")
    expect(second.case.visitorId).toBe("vis-1")
    expect(second.case.energy).toBe("high")
  })

  it("imports a form lead as not-yet-followed", () => {
    const lead: Lead = {
      id: "lead-1",
      at: now,
      name: "赵",
      org: "",
      email: "zhao@example.com",
      note: "茶叶基地",
      source: "form",
    }
    const cases = importLeads([], [lead], now)
    expect(cases[0]?.following).toBe(false)
    expect(cases[0]?.owner).toBe("hermes")
    expect(importLeads(cases, [lead], now)).toHaveLength(1)
  })

  it("recognizes a human-owned visitor", () => {
    const cases = [sample({ visitorId: "vis-9", owner: "human", following: false })]
    expect(isHumanOwned(cases, "vis-9")).toBe(true)
    expect(isHumanOwned(cases, "vis-other")).toBe(false)
    expect(findHermesCase(cases, { visitorId: "vis-9" })?.name).toBe("王先生")
  })
})

describe("desk coach protocol", () => {
  it("strips desk tags and applies updates", () => {
    const parsed = extractDeskUpdates(
      '先跟王先生要吨位。\n<desk>{"updates":[{"id":"case-1","progress":"sample","energy":"high","reaction":"要样品"}]}</desk>',
    )
    expect(parsed.reply).toBe("先跟王先生要吨位。")
    expect(parsed.updates[0]?.progress).toBe("sample")
  })

  it("briefs Hermes without putting raw emails in the roster line", () => {
    const messages = buildCoachMessages([sample({ contact: "boss@example.com" })], [])
    expect(messages[0]?.content).toContain("已留联系方式")
    expect(messages[0]?.content).not.toContain("boss@example.com")
    expect(messages[0]?.content).toContain("不要提 NAS")
  })

  it("builds a case from an AI lead as already followed", () => {
    const item = caseFromLead({
      id: "lead-2",
      at: now,
      name: "吴",
      org: "合作社",
      email: "",
      contact: "微信号 abc",
      note: "甘蔗",
      source: "ai",
    })
    expect(item.following).toBe(true)
    expect(item.source).toBe("ai")
  })
})
