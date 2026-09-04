import { describe, expect, it } from "vitest"
import {
  applyInquiryTaskAction,
  applyMemoryPatch,
  applyResume,
  applyTakeover,
  applyStaffCaseUpdate,
  applyStaffCasesBatch,
  applyStaffCasesDelete,
  attachLead,
  canWriteLiveHermesCase,
  caseFromLead,
  dedupeHermesCases,
  emptyLedger,
  markGoneOnLedger,
  fileFinding,
  boardMetrics,
  buildCoachMessages,
  decorateDeskPayload,
  customerArchives,
  customerKey,
  deskStats,
  extractDeskUpdates,
  factoryArchives,
  factoryName,
  filterHermesCases,
  findHermesCase,
  formatInquiryRate,
  frontHermesExtra,
  mergeSharedMemoryHint,
  staffSharedMemoryHint,
  importLeads,
  isHumanOwned,
  isIdentitySuppressed,
  isStaffAction,
  progressRatio,
  pruneUnspokenCases,
  publicVisitorContext,
  recordInquiry,
  resolveCoachReply,
  coachUnavailableReply,
  sanitizeCoachImages,
  stageFill,
  ticketNo,
  ticketsForCustomer,
  ticketsForFactory,
  matchDeskSearch,
  newTicketNo,
  upsertFromTicket,
  upsertFromVisit,
  type HermesCase,
} from "./hermesDesk"
import { emptyInquiry, extractInquiryUpdates } from "./inquiryDesk"
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
    expect(filterHermesCases(cases, { query: "某农业" })[0]?.id).toBe("case-1")
    expect(filterHermesCases(cases, { query: "1380000" })[0]?.id).toBe("case-1")
    expect(filterHermesCases(cases, { query: ticketNo(sample()) })[0]?.id).toBe("case-1")
    expect(filterHermesCases(cases, { query: "水稻" })).toHaveLength(0)
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
    expect(second.case.energy).toBe("unset")
    expect(ticketNo(first.case)).toBeTruthy()
    expect(ticketNo(second.case)).toBe(ticketNo(first.case))
    expect(first.case.inquiryCount).toBe(1)
    const again = upsertFromVisit(first.cases, "vis-1", "再问吨位", "2026-09-03T13:00:00.000Z")
    expect(again.case.inquiryCount).toBe(2)
    expect(again.case.inquiryPaceMin).toBe(60)
    expect(again.case.replyPaceMin).toBe(60)
  })

  it("turns real form leads into tickets and files inquiry findings", () => {
    const lead: Lead = {
      id: "lead-1",
      at: now,
      name: "赵",
      org: "",
      email: "zhao@example.com",
      note: "茶叶基地",
      source: "form",
    }
    const imported = importLeads([], [lead], now)
    expect(imported).toHaveLength(1)
    expect(imported[0]?.source).toBe("form")
    expect(attachLead([], [lead], "lead-1", now).error).toBeNull()
    const filed = fileFinding(
      {
        targets: [],
        findings: [{ id: "find-1", at: now, org: "绿田加工厂", source: "同事名片", outreach: "draft" }],
        job: { status: "review", brief: "土壤板结", updatedAt: now },
      },
      [],
      "find-1",
      now,
    )
    expect(filed.error).toBeNull()
    expect(filed.case?.factory).toBe("绿田加工厂")
    expect(filed.inquiry.findings[0]?.caseId).toBe(filed.case?.id)
    expect(fileFinding({ targets: [], findings: [], job: { status: "idle", brief: "", updatedAt: "" } }, [], "missing").error).toBe(
      "missing",
    )
  })

  it("keeps front-of-house context free of desk fields", () => {
    const item = sample({
      contact: "boss@example.com",
      evaluation: "内部看好",
      energy: "high",
      factory: "绿田加工厂",
      nextAction: "寄样品",
      progress: "sample",
    })
    const extra = frontHermesExtra({ shared: "记住先问作物", desk: "别把工作台说出去", updatedAt: now }, item)
    expect(publicVisitorContext(item)).toContain("王先生")
    expect(publicVisitorContext(item)).toContain("寄样品")
    expect(publicVisitorContext(item)).toContain("绿田加工厂")
    expect(publicVisitorContext(item)).toContain("样品/方案")
    expect(publicVisitorContext(item)).not.toContain("内部看好")
    expect(publicVisitorContext(item)).not.toContain("boss@example.com")
    expect(extra).toContain("记住先问作物")
    expect(extra).not.toContain("别把工作台说出去")
    expect(extra).not.toContain("内部看好")
  })

  it("uses the signed backup for workbench chat when live keys are missing", async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ source: "hermes", reply: "收到。我先按这份报价跟王先生。" }), { status: 200 })
    try {
      const result = await resolveCoachReply(
        [sample()],
        [{ id: "t1", at: now, role: "staff", content: "记住：本周报价以FOB马尼拉为准" }],
        { SIGNED_GUIDE_FALLBACK: "1" },
        { shared: "", desk: "", updatedAt: now },
      )
      expect(result.source).toBe("hermes")
      expect(result.reply).toContain("报价")
      expect(result.reply).not.toBe(coachUnavailableReply())
      expect(result.memory?.shared).toContain("FOB马尼拉")
    } finally {
      globalThis.fetch = original
    }
  })

  it("does not pretend the workbench chat is live when no line is configured", async () => {
    const result = await resolveCoachReply([], [{ id: "t1", at: now, role: "staff", content: "先问作物" }], {})
    expect(result.source).toBe("local")
    expect(result.reply).toBe(coachUnavailableReply())
  })

  it("lets staff write shared memory that the front can read", () => {
    expect(staffSharedMemoryHint("记住：本周报价以FOB马尼拉为准")).toBe("本周报价以FOB马尼拉为准")
    expect(staffSharedMemoryHint("同步到前台，先问作物和吨位")).toBe("先问作物和吨位")
    expect(staffSharedMemoryHint("先跟王先生要吨位")).toBe("")
    const next = mergeSharedMemoryHint({ shared: "旧记忆", desk: "仅后台", updatedAt: "" }, "本周报价以FOB马尼拉为准")
    expect(next?.shared).toContain("旧记忆")
    expect(next?.shared).toContain("本周报价以FOB马尼拉为准")
    expect(next?.desk).toBe("仅后台")
  })

  it("keeps real form tickets on the live board and can prune empty stubs", () => {
    const form = sample({ id: "case-form", source: "form", leadId: "lead-1", visitorId: undefined, reaction: "", evaluation: "", energy: "unset" })
    const stub = sample({ id: "case-stub", source: "form", leadId: undefined, visitorId: undefined, gone: true })
    const live = sample()
    expect(filterHermesCases([form, live], { origin: "live" }).map((item) => item.id).sort()).toEqual(["case-1", "case-form"])
    expect(filterHermesCases([form, stub, live], { origin: "live" }).map((item) => item.id).sort()).toEqual(["case-1", "case-form"])
    expect(pruneUnspokenCases([form, live]).map((item) => item.id).sort()).toEqual(["case-1", "case-form"])
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
    expect(messages[0]?.content).toContain("同一个人")
    expect(messages[0]?.content).toContain("权限更高")
    expect(messages[0]?.content).toContain("一键接管也只能由你执行")
    expect(messages[0]?.content).toContain("mailStatus")
    expect(messages[0]?.content).toContain("不要编发送成功")
    expect(messages[0]?.content).toContain("询单模块")
    expect(messages[0]?.content).toContain("<inquiry>")
    expect(messages[0]?.content).toContain("Linda")
    expect(messages[0]?.content).not.toContain("Karmenai")
  })

  it("keeps desk and inquiry tags on the same coach reply without mixing them", () => {
    const raw =
      '先跟王先生，再按土壤板结找厂。\n<desk>{"updates":[{"id":"case-1","progress":"talking"}]}</desk>\n<inquiry>{"job":{"status":"review","brief":"土壤板结"},"findings":[{"org":"绿田加工厂","source":"同事提供","outreach":"sent"}]}</inquiry>'
    const desk = extractDeskUpdates(raw)
    expect(desk.reply).toBe("先跟王先生，再按土壤板结找厂。")
    expect(desk.updates[0]?.progress).toBe("talking")
    expect(desk.reply).not.toContain("<inquiry>")
    expect(desk.reply).not.toContain("<desk>")
    const inquiry = extractInquiryUpdates(raw)
    expect(inquiry.findings[0]?.org).toBe("绿田加工厂")
    expect(inquiry.job?.status).toBe("review")
  })

  it("puts inquiry state on the same desk payload Hermes already uses", () => {
    const packed = decorateDeskPayload({
      cases: [],
      coach: [],
      events: [],
      memory: { shared: "", desk: "", updatedAt: "" },
      health: null,
      link: { configured: false, model: "", host: "" },
      hermesReady: false,
      attachable: [],
      inquiry: {
        targets: [{ id: "tg-1", label: "化肥成本高", at: now }],
        findings: [],
        job: { status: "idle", brief: "", updatedAt: "" },
      },
    })
    expect(packed.inquiry.targets[0]?.label).toBe("化肥成本高")
    const briefed = buildCoachMessages([], [], undefined, undefined, packed.inquiry)
    expect(briefed[0]?.content).toContain("化肥成本高")
    expect(briefed[0]?.content).toContain("还没有真实找到的厂商")
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

  it("lets Hermes patch mail fields and memory through desk tags", () => {
    const parsed = extractDeskUpdates(
      '记下了回邮。\n<desk>{"memory":{"shared":"先问作物"},"updates":[{"id":"case-1","mailStatus":"sent","mailFollowUp":true,"mailTracking":"opened","mailSummary":"要样品"}]}</desk>',
    )
    expect(parsed.reply).toBe("记下了回邮。")
    expect(parsed.updates[0]).toMatchObject({
      mailStatus: "sent",
      mailFollowUp: true,
      mailTracking: "opened",
      mailSummary: "要样品",
    })
    expect(parsed.memory?.shared).toBe("先问作物")
    expect(applyMemoryPatch({ shared: "", desk: "旧笔记", updatedAt: "" }, parsed.memory || {}).desk).toBe("旧笔记")
  })
})

describe("desk board telemetry", () => {
  it("keeps an empty board empty instead of inventing mail or speed", () => {
    expect(boardMetrics([])).toMatchObject({
      live: 0,
      inquiries: 0,
      mailSent: 0,
      mailFailed: 0,
      mailFollow: 0,
      mailTracked: 0,
      mailSummarized: 0,
      avgInquiryPace: undefined,
      avgReplyPace: undefined,
      avgMailReply: undefined,
      worldProgress: 0,
    })
  })

  it("turns progress into a bar ratio and counts real inquiries only", () => {
    expect(progressRatio("new")).toBe(0)
    expect(progressRatio("closed")).toBe(1)
    expect(progressRatio("talking")).toBeGreaterThan(0)
    const paced = recordInquiry(
      sample({ inquiryCount: 1, lastInquiryAt: now, lastAdvisorAt: now }),
      "2026-09-03T14:00:00.000Z",
    )
    expect(paced.inquiryCount).toBe(2)
    expect(paced.inquiryPaceMin).toBe(120)
    expect(formatInquiryRate(sample({ inquiryCount: 2, at: now }), Date.parse("2026-09-10T12:00:00.000Z"))).toContain("次 / 周")
    const metrics = boardMetrics([sample({ mailStatus: "sent", mailFollowUp: true, mailTracking: "on", inquiryCount: 3 })])
    expect(metrics.mailSent).toBe(1)
    expect(metrics.mailFollow).toBe(1)
    expect(metrics.inquiries).toBe(3)
  })

  it("blocks staff from board writes and rejects junk images", () => {
    expect(isStaffAction("health")).toBe(true)
    expect(isStaffAction("coach")).toBe(true)
    expect(isStaffAction("targets")).toBe(true)
    expect(isStaffAction("job")).toBe(true)
    expect(isStaffAction("file")).toBe(true)
    expect(isStaffAction("attach")).toBe(true)
    expect(isStaffAction("import")).toBe(true)
    expect(isStaffAction("takeover")).toBe(false)
    expect(isStaffAction("update")).toBe(false)
    expect(isStaffAction("memory")).toBe(false)
    expect(sanitizeCoachImages([{ mime: "image/png", name: "a.png", data: "abcd" }])).toHaveLength(1)
    expect(sanitizeCoachImages([{ mime: "application/pdf", name: "x.pdf", data: "abcd" }])).toHaveLength(0)
    expect(sanitizeCoachImages([{ mime: "image/png", name: "bad", data: "not-base64!!" }])).toHaveLength(0)
  })

  it("gives each pipeline step its own fill and files factory archives", () => {
    expect(stageFill("talking", "new")).toBe(1)
    expect(stageFill("talking", "talking")).toBeGreaterThan(0)
    expect(stageFill("talking", "talking")).toBeLessThan(1)
    expect(stageFill("talking", "closed")).toBe(0)
    expect(factoryName(sample({ factory: "绿田加工厂", org: "某集团" }))).toBe("绿田加工厂")
    expect(factoryName(sample({ org: "某集团" }))).toBe("某集团")
    const filed = [
      sample({ id: "a", visitorId: "v1", factory: "一号厂" }),
      sample({ id: "b", visitorId: "v2", factory: "一号厂", updatedAt: "2026-09-03T13:00:00.000Z" }),
    ]
    expect(customerKey(filed[0]!)).toBe("v1")
    expect(customerArchives(filed)).toHaveLength(2)
    expect(customerArchives(filed)[0]?.id).toBe("b")
    expect(factoryArchives(filed)).toHaveLength(1)
    expect(factoryArchives(filed)[0]?.count).toBe(2)
    expect(factoryArchives(filed)[0]?.tickets).toHaveLength(2)
    expect(ticketsForFactory(filed, "一号厂")).toHaveLength(2)
    expect(ticketsForCustomer(filed, "v1")).toHaveLength(1)
    expect(factoryArchives([sample({ org: "", factory: "" })])).toHaveLength(0)
  })

  it("gives every ticket a number and searches number, phone, email, or company", () => {
    const first = sample({ id: "case-old", contact: "138-0000-1111", org: "绿田农业" })
    const second = sample({
      id: "case-new",
      visitorId: "v9",
      ticketNo: newTicketNo([first], now),
      contact: "boss@greenfield.example",
      org: "Green Field Co",
    })
    expect(ticketNo(first)).toMatch(/^VA20260903-/)
    expect(ticketNo(second)).toBe("VA20260903-001")
    expect(matchDeskSearch(first, "VA20260903")).toBe(true)
    expect(matchDeskSearch(first, "13800001111")).toBe(true)
    expect(matchDeskSearch(second, "boss@greenfield.example")).toBe(true)
    expect(matchDeskSearch(second, "Green Field")).toBe(true)
    expect(matchDeskSearch(first, "不存在的公司")).toBe(false)
    expect(filterHermesCases([first, second], { query: "greenfield" })[0]?.id).toBe("case-new")
  })

  it("lets staff edit, batch edit, and delete tickets", () => {
    const first = sample({ id: "case-a", name: "测试甲" })
    const second = sample({ id: "case-b", name: "测试乙", progress: "new" })
    const edited = applyStaffCaseUpdate([first, second], "case-a", { name: "陈经理", progress: "talking" }, now)
    expect(edited.error).toBeNull()
    expect(edited.case?.name).toBe("陈经理")
    expect(edited.cases[0]?.progress).toBe("talking")
    const batched = applyStaffCasesBatch(edited.cases, ["case-a", "case-b"], { progress: "hold" }, now)
    expect(batched.count).toBe(2)
    expect(batched.cases.every((item) => item.progress === "hold")).toBe(true)
    const deleted = applyStaffCasesDelete(batched.cases, ["case-a"], now)
    expect(deleted.count).toBe(1)
    expect(deleted.cases.some((item) => item.id === "case-a")).toBe(false)
    expect(isStaffAction("cases")).toBe(true)
    expect(isStaffAction("coach-clear")).toBe(true)
    expect(isStaffAction("task")).toBe(true)
  })

  it("creates a page-owned inquiry ticket with the task and supports cancel and delete", () => {
    const created = applyInquiryTaskAction(
      emptyInquiry(),
      [],
      emptyLedger(),
      {
        op: "create",
        name: "土壤板结一轮",
        targets: ["土壤板结"],
        schedule: { kind: "daily", hour: 9 },
        limitHours: 24,
      },
      now,
    )
    expect(created.error).toBeUndefined()
    expect(created.inquiry.tasks).toHaveLength(1)
    expect(created.cases).toHaveLength(1)
    expect(created.cases[0]?.category).toBe("inquiry")
    expect(created.cases[0]?.org).toBe("询单系统")
    expect(created.inquiry.tasks[0]?.caseId).toBe(created.cases[0]?.id)
    expect(created.inquiry.tasks[0]?.quota).toBe(8)
    const started = applyInquiryTaskAction(created.inquiry, created.cases, created.ledger, { op: "start", id: created.inquiry.tasks[0]!.id }, now)
    expect(started.inquiry.job.status).toBe("searching")
    expect(started.assignMessage).toContain("土壤板结")
    expect(started.cases[0]?.progress).toBe("talking")
    const cancelled = applyInquiryTaskAction(started.inquiry, started.cases, started.ledger, { op: "cancel", id: created.inquiry.tasks[0]!.id }, now)
    expect(cancelled.inquiry.tasks[0]?.status).toBe("cancelled")
    expect(cancelled.cases[0]?.progress).toBe("hold")
    const deleted = applyInquiryTaskAction(cancelled.inquiry, cancelled.cases, cancelled.ledger, { op: "delete", id: created.inquiry.tasks[0]!.id }, now)
    expect(deleted.inquiry.tasks).toHaveLength(0)
    expect(deleted.cases.some((item) => item.id === created.cases[0]!.id)).toBe(false)
    expect(deleted.ledger.goneIds).toContain(created.cases[0]!.id)
  })

  it("keeps deleted tickets gone even if the same lead is imported again", () => {
    const lead: Lead = {
      id: "lead-chen",
      at: now,
      name: "陈经理",
      org: "江西绿田农业",
      email: "chen@example.com",
      note: "测试",
      source: "form",
    }
    const created = caseFromLead(lead, now)
    const deleted = applyStaffCasesDelete([created], [created.id], now)
    expect(deleted.count).toBe(1)
    const ledger = markGoneOnLedger(emptyLedger(), deleted.gone[0]!, now)
    const revived = importLeads(deleted.cases, [lead], now, ledger)
    expect(revived).toHaveLength(0)
    const attached = attachLead(deleted.cases, [lead], "lead-chen", now, ledger)
    expect(attached.case?.name).toBe("陈经理")
    expect(attached.ledger.goneLeadIds).not.toContain("lead-chen")
    const tagged = applyStaffCaseUpdate([created], created.id, { color: "red", category: "test" }, now)
    expect(tagged.case?.color).toBe("red")
    expect(tagged.case?.category).toBe("test")
    expect(filterHermesCases([tagged.case!], { color: "red", category: "test" })).toHaveLength(1)
    expect(dedupeHermesCases([created, { ...created, id: "case-copy", updatedAt: "2026-09-01T00:00:00.000Z" }])).toHaveLength(1)
  })

  it("does not recreate a deleted visitor or contact ticket", () => {
    const first = upsertFromVisit([], "vis-talk", "先问用量", now)
    expect(first.case?.name).toBe("对话客户")
    const deleted = applyStaffCasesDelete(first.cases, [first.case!.id], now)
    const ledger = markGoneOnLedger(emptyLedger(), deleted.gone[0]!, now)
    expect(isIdentitySuppressed({ visitorId: "vis-talk" }, ledger)).toBe(true)
    const again = upsertFromVisit(deleted.cases, "vis-talk", "刷新后再聊", now, ledger)
    expect(again.case).toBeNull()
    expect(again.cases).toHaveLength(0)
    const ticketed = upsertFromTicket(
      deleted.cases,
      { name: "陈经理", org: "江西绿田农业", contact: "13900001111", note: "还在" },
      { visitorId: "vis-talk" },
      now,
      ledger,
    )
    expect(ticketed.case).toBeNull()
    expect(ticketed.cases).toHaveLength(0)
    const named = sample({ id: "case-chen", name: "陈经理", contact: "13900001111", visitorId: "vis-chen" })
    const goneNamed = applyStaffCasesDelete([named], [named.id], now)
    const namedLedger = markGoneOnLedger(emptyLedger(), goneNamed.gone[0]!, now)
    const sameContact = upsertFromTicket(
      goneNamed.cases,
      { name: "陈经理", org: "江西绿田农业", contact: "13900001111", note: "线索又来了" },
      { visitorId: "vis-new" },
      now,
      namedLedger,
    )
    expect(sameContact.case).toBeNull()
    expect(canWriteLiveHermesCase({ ...first.case!, gone: false }, { ...first.case!, gone: true }, ledger)).toBe(false)
    expect(canWriteLiveHermesCase({ ...first.case!, id: "case-fresh", gone: false }, null, ledger)).toBe(false)
    expect(canWriteLiveHermesCase({ ...first.case!, gone: true }, { ...first.case!, gone: true }, ledger)).toBe(true)
  })

  it("does not mint a replacement ticket after an inquiry case is deleted", () => {
    const created = applyInquiryTaskAction(
      emptyInquiry(),
      [],
      emptyLedger(),
      {
        op: "create",
        name: "土壤板结一轮",
        targets: ["土壤板结"],
        schedule: { kind: "daily", hour: 9 },
        limitHours: 24,
      },
      now,
    )
    const caseId = created.cases[0]!.id
    const deleted = applyStaffCasesDelete(created.cases, [caseId], now)
    const ledger = markGoneOnLedger(created.ledger, deleted.gone[0]!, now)
    const updated = applyInquiryTaskAction(
      created.inquiry,
      deleted.cases,
      ledger,
      { op: "update", id: created.inquiry.tasks[0]!.id, name: "还在找厂" },
      now,
    )
    expect(updated.cases).toHaveLength(0)
    expect(updated.touched).toHaveLength(0)
    expect(updated.inquiry.tasks[0]?.caseId).toBe(caseId)
  })
})
