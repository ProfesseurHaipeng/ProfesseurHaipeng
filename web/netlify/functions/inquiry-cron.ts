import type { Config } from "@netlify/functions"
import { appendHermesEvent, readHermesCases, readHermesCoach, readHermesLedger, readInquiryState, writeHermesCoach, writeInquiryState } from "../../src/cms/hermesBlobs"
import { applyInquiryTaskAction, newCoachTurnId, newEventId } from "../../src/cms/hermesDesk"
import { migrateInquiryTasks, tickInquiryTasks } from "../../src/cms/inquiryDesk"
import { runInquiryRound } from "../../src/cms/inquiryOutreach"

function envBag() {
  return {
    HERMES_API_BASE: process.env.HERMES_API_BASE,
    HERMES_API_KEY: process.env.HERMES_API_KEY,
    HERMES_MODEL: process.env.HERMES_MODEL,
    SENIOR_ADVISOR_API_BASE: process.env.SENIOR_ADVISOR_API_BASE,
    SENIOR_ADVISOR_API_KEY: process.env.SENIOR_ADVISOR_API_KEY,
    SENIOR_ADVISOR_MODEL: process.env.SENIOR_ADVISOR_MODEL,
    INQUIRY_WORKBENCH_URL: process.env.INQUIRY_WORKBENCH_URL,
    INQUIRY_WORKBENCH_KEY: process.env.INQUIRY_WORKBENCH_KEY,
    INQUIRY_SEARCH_ENDPOINT: process.env.INQUIRY_SEARCH_ENDPOINT,
    INQUIRY_SEARCH_KEY: process.env.INQUIRY_SEARCH_KEY,
    BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
    SITE_URL: process.env.SITE_URL || process.env.URL,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    SENDGRID_FROM: process.env.SENDGRID_FROM,
  }
}

export default async () => {
  const now = new Date().toISOString()
  const migrated = migrateInquiryTasks(await readInquiryState())
  const ticked = tickInquiryTasks(migrated.state, now)
  const cases = await readHermesCases({ includeGone: true })
  const ledger = await readHermesLedger()
  const started = applyInquiryTaskAction(ticked.state, cases, ledger, { op: "tick" }, now)
  const task = started.assignMessage
    ? started.inquiry.tasks.find((item) => item.id === started.inquiry.currentId)
    : null
  if (!task || task.status !== "searching") {
    if (ticked.changed) await writeInquiryState(ticked.state)
    return new Response(JSON.stringify({ ran: false }), { status: 200 })
  }
  const run = await runInquiryRound({ inquiry: started.inquiry, task, env: envBag(), now })
  await writeInquiryState(run.inquiry)
  const history = await readHermesCoach()
  await writeHermesCoach([
    ...history,
    { id: newCoachTurnId(), at: now, role: "staff", content: "按节奏继续询单。" },
    { id: newCoachTurnId(Date.now() + 1), at: new Date().toISOString(), role: "hermes", content: run.report },
  ])
  await appendHermesEvent({
    id: newEventId(),
    at: now,
    kind: "coach",
    text: run.report.replace(/\n/g, " ").slice(0, 180),
    caseId: started.caseId,
  })
  return new Response(JSON.stringify({ ran: true, sent: run.sent, drafted: run.drafted }), { status: 200 })
}

export const config: Config = {
  schedule: "@hourly",
}
