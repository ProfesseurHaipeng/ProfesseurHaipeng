import { describe, expect, it } from "vitest"
import {
  addInquiryTarget,
  applyInquiryState,
  applyStaffJob,
  applyTargetWrite,
  cancelInquiryTask,
  createInquiryTask,
  deleteInquiryTask,
  emptyInquiry,
  extractInquiryUpdates,
  hydrateInquiryState,
  buildInquiryAssignMessage,
  buildTaskAssignMessage,
  inquiryPromptPreview,
  inquiryRunHint,
  inquiryRunIndex,
  inquiryStepFill,
  migrateInquiryTasks,
  startInquiryTask,
  taskDueAt,
  tickInquiryTasks,
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

  it("builds the same assign message the panel sends to coach", () => {
    const targets = [{ id: "tg-1", label: "土壤板结", at: now }]
    const message = buildInquiryAssignMessage(targets)
    expect(message).toContain("土壤板结")
    expect(message).toContain("取条件")
    const preview = inquiryPromptPreview({ ...emptyInquiry(), targets })
    expect(preview.userMessage).toBe(message)
    expect(preview.systemExcerpt).toContain("土壤板结")
    expect(preview.targetCount).toBe(1)
  })

  it("briefs the same Hermes with current targets and empty findings", () => {
    const preview = inquiryPromptPreview({
      ...emptyInquiry(),
      targets: [{ id: "tg-1", label: "化肥成本高", at: now }],
    })
    expect(preview.systemExcerpt).toContain("化肥成本高")
    expect(preview.systemExcerpt).toContain("<inquiry>")
    expect(preview.findingCount).toBe(0)
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

  it("lets staff start or pause a job but not mark review themselves", () => {
    const started = applyStaffJob({ status: "idle", brief: "", updatedAt: "" }, [{ id: "tg-1", label: "土壤板结", at: now }], "searching", now)
    expect(started.error).toBeNull()
    expect(started.job.status).toBe("searching")
    expect(applyStaffJob(started.job, [{ id: "tg-1", label: "土壤板结", at: now }], "review", now).error).toBe("hermes-only")
    expect(applyStaffJob(started.job, [], "searching", now).error).toBe("empty")
  })

  it("creates, starts, cancels, and deletes an inquiry task without inventing factories", () => {
    const created = createInquiryTask(
      emptyInquiry(),
      { name: "土壤板结一轮", targets: ["土壤板结"], schedule: { kind: "daily", hour: 9 }, limitHours: 24 },
      now,
    )
    expect(created.error).toBeNull()
    expect(created.task?.name).toBe("土壤板结一轮")
    expect(created.task?.targets[0]?.label).toBe("土壤板结")
    expect(created.task?.quota).toBe(8)
    expect(created.state.currentId).toBe(created.task?.id)
    const started = startInquiryTask(created.state, created.task!.id, now)
    expect(started.error).toBeNull()
    expect(started.state.job.status).toBe("searching")
    expect(started.task?.dueAt).toBe(taskDueAt(24, now))
    expect(buildTaskAssignMessage(started.task!)).toContain("土壤板结")
    expect(buildTaskAssignMessage(started.task!)).toContain("最多找 8 家")
    expect(buildTaskAssignMessage(started.task!)).toContain("没有发信口")
    const cancelled = cancelInquiryTask(started.state, created.task!.id, now)
    expect(cancelled.task?.status).toBe("cancelled")
    expect(cancelled.state.job.status).toBe("paused")
    const deleted = deleteInquiryTask(cancelled.state, created.task!.id)
    expect(deleted.state.tasks).toHaveLength(0)
  })

  it("times out a searching task when the limit is up", () => {
    const created = createInquiryTask(emptyInquiry(), { name: "限时一轮", instruction: "找有来源的厂", limitHours: 1 }, now)
    const started = startInquiryTask(created.state, created.task!.id, now)
    const later = "2026-09-03T13:05:00.000Z"
    const ticked = tickInquiryTasks(started.state, later)
    expect(ticked.changed).toBe(true)
    expect(ticked.state.tasks[0]?.status).toBe("timeout")
    expect(ticked.state.job.status).toBe("paused")
  })

  it("hydrates stored tasks and migrates a legacy job into one task", () => {
    const state = hydrateInquiryState({
      targets: [{ id: "tg-1", label: "茶叶基地", at: now }],
      findings: [],
      job: { status: "searching", brief: "茶叶基地", updatedAt: now },
      tasks: [{ id: "task-1", name: "茶叶", instruction: "找基地", targets: [{ id: "tg-1", label: "茶叶基地", at: now }], status: "searching" }],
      currentId: "task-1",
    })
    expect(state.tasks[0]?.name).toBe("茶叶")
    expect(state.currentId).toBe("task-1")
    const migrated = migrateInquiryTasks({
      ...emptyInquiry(),
      targets: [{ id: "tg-2", label: "水稻加工厂", at: now }],
      job: { status: "searching", brief: "水稻加工厂", updatedAt: now },
    }, now)
    expect(migrated.changed).toBe(true)
    expect(migrated.state.tasks).toHaveLength(1)
    expect(migrated.state.tasks[0]?.targets[0]?.label).toBe("水稻加工厂")
  })

  it("writes quota and demand into the same assign Hermes will read", () => {
    const created = createInquiryTask(
      emptyInquiry(),
      { name: "化妆品一轮", targets: ["化妆品厂家"], quota: 5, limitHours: 12 },
      now,
    )
    expect(created.task?.quota).toBe(5)
    const message = buildTaskAssignMessage(created.task!)
    expect(message).toContain("化妆品厂家")
    expect(message).toContain("最多找 5 家")
    expect(message).toContain("12 小时")
    const preview = inquiryPromptPreview(created.state)
    expect(preview.systemExcerpt).toContain("化妆品厂家")
    expect(preview.systemExcerpt).toContain("家数上限=5")
    expect(preview.userMessage).toBe(message)
  })
})
