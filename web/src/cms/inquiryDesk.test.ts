import { describe, expect, it } from "vitest"
import {
  addInquiryTarget,
  applyInquiryState,
  applyTargetWrite,
  emptyInquiry,
  extractInquiryUpdates,
  hydrateInquiryState,
  inquiryCoachExtra,
  inquiryRunHint,
  inquiryRunIndex,
  inquiryStepFill,
  sanitizeFinding,
} from "./inquiryDesk"

const now = "2026-09-03T12:00:00.000Z"

describe("inquiry module on the desk", () => {
  it("lets staff set and remove target pains without inventing factories", () => {
    const added = addInquiryTarget([], "土壤板结", now)
    expect(added.error).toBeNull()
    expect(added.targets[0]?.label).toBe("土壤板结")
    const again = addInquiryTarget(added.targets, "土壤板结", now)
    expect(again.error).toBe("exists")
    const removed = applyTargetWrite(added.targets, { remove: added.targets[0]!.id }, now)
    expect(removed.targets).toHaveLength(0)
  })

  it("drops findings that have no real org or source", () => {
    expect(sanitizeFinding({ org: "某厂" }, now)).toBeNull()
    expect(sanitizeFinding({ org: "某厂", source: "同事提供的名片" }, now)?.org).toBe("某厂")
    expect(sanitizeFinding({ org: "某厂", source: "公开名录", outreach: "sent" }, now)?.outreach).toBe("draft")
  })

  it("reads inquiry tags from the same coach reply as desk tags", () => {
    const parsed = extractInquiryUpdates(
      '先按土壤板结找。\n<inquiry>{"job":{"status":"review","brief":"土壤板结"},"findings":[{"org":"绿田加工厂","source":"同事提供","outreach":"draft"}]}</inquiry>',
    )
    expect(parsed.reply).toBe("先按土壤板结找。")
    expect(parsed.findings[0]?.org).toBe("绿田加工厂")
    const next = applyInquiryState(emptyInquiry(), parsed)
    expect(next.job.status).toBe("review")
    expect(next.findings).toHaveLength(1)
  })

  it("briefs the same Hermes with current targets and empty findings", () => {
    const extra = inquiryCoachExtra({
      ...emptyInquiry(),
      targets: [{ id: "tg-1", label: "化肥成本高", at: now }],
    })
    expect(extra).toContain("化肥成本高")
    expect(extra).toContain("还没有真实找到的厂商")
    expect(extra).toContain("<inquiry>")
  })

  it("hydrates stored inquiry and refuses invented or already-sent rows", () => {
    const state = hydrateInquiryState({
      targets: [{ id: "tg-1", label: "土壤板结", at: now }, { label: "" }],
      findings: [
        { org: "绿田加工厂", source: "同事名片", outreach: "sent" },
        { org: "没有来源的厂" },
      ],
      job: { status: "searching", brief: "土壤板结", updatedAt: now },
    })
    expect(state.targets).toHaveLength(1)
    expect(state.findings).toHaveLength(1)
    expect(state.findings[0]?.outreach).toBe("draft")
    expect(state.job.status).toBe("searching")
  })

  it("maps the same four-step run the board shows", () => {
    expect(inquiryRunIndex("idle", 0)).toBe(-1)
    expect(inquiryRunIndex("idle", 2)).toBe(0)
    expect(inquiryStepFill("idle", 2, 0)).toBe("done")
    expect(inquiryStepFill("searching", 2, 1)).toBe("now")
    expect(inquiryStepFill("review", 2, 1)).toBe("done")
    expect(inquiryStepFill("review", 2, 2)).toBe("now")
    expect(inquiryRunHint("review", 2)).toContain("核实来源")
    expect(inquiryRunHint("idle", 0)).toContain("先设定")
  })
})
