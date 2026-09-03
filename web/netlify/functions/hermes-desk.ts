import type { Config } from "@netlify/functions"
import { hermesLinkInfo, hermesReady, probeHermes } from "../../src/cms/hermes"
import {
  appendHermesEvent,
  readHermesCases,
  readHermesCoach,
  readHermesEvents,
  readHermesHealth,
  readHermesImage,
  readHermesLedger,
  readHermesMemory,
  readInquiryState,
  writeHermesCase,
  writeHermesCoach,
  writeHermesHealth,
  writeHermesImage,
  writeHermesLedger,
  writeHermesMemory,
  writeInquiryState,
} from "../../src/cms/hermesBlobs"
import { applyStaffJob, applyTargetWrite } from "../../src/cms/inquiryDesk"
import {
  applyStaffCaseUpdate,
  applyStaffCasesBatch,
  applyStaffCasesDelete,
  attachLead,
  liveCases,
  markGoneOnLedger,
  attachableLeads,
  decorateDeskPayload,
  emptyMemory,
  fileFinding,
  importLeads,
  isStaffAction,
  newCoachTurnId,
  newEventId,
  publicAttachable,
  resolveCoachReply,
  sanitizeCoachImages,
  type HermesCoachTurn,
  type HermesDeskFilter,
  type HermesEvent,
} from "../../src/cms/hermesDesk"
import { sortLeads, type Lead } from "../../src/cms/leads"

/**
 * Staff Hermes desk. Same person / same shared memory as frontend Hermes.
 * Desk privilege is higher. Frontend never receives desk memory, coach, or other cases.
 *
 * GET  /api/hermes-desk
 * POST /api/hermes-desk  { action }
 *   staff: health | coach | targets | job | file | attach | import | cases | coach-clear
 *   Hermes-only via <desk> / <inquiry> in coach: progress, mail notes, memory, findings
 */

type BlobStore = {
  get: (key: string, options: { type: "json" }) => Promise<unknown>
  list: () => Promise<{ blobs: { key: string }[] }>
}

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Admin-User,X-Admin-Pass",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors })

function readEnv(name: string) {
  try {
    const fromNetlify = typeof Netlify === "undefined" ? undefined : Netlify.env.get(name)
    return fromNetlify || process.env[name] || ""
  } catch {
    return process.env[name] || ""
  }
}

function envBag() {
  return {
    HERMES_API_BASE: readEnv("HERMES_API_BASE"),
    HERMES_API_KEY: readEnv("HERMES_API_KEY"),
    HERMES_MODEL: readEnv("HERMES_MODEL"),
  }
}

function isStaff(req: Request) {
  const user = readEnv("ADMIN_USER") || "admin"
  const pass = readEnv("ADMIN_PASSWORD") || "ash-draft"
  return req.headers.get("x-admin-user") === user && req.headers.get("x-admin-pass") === pass
}

function asFilter(url: URL): HermesDeskFilter {
  const follow = url.searchParams.get("follow")
  const owner = url.searchParams.get("owner")
  const energy = url.searchParams.get("energy")
  const origin = url.searchParams.get("origin")
  return {
    follow: follow === "following" || follow === "idle" ? follow : "all",
    owner: owner === "hermes" || owner === "human" ? owner : "all",
    energy: energy === "high" || energy === "mid" || energy === "low" || energy === "unset" ? energy : "all",
    origin: origin === "live" || origin === "all" ? origin : undefined,
    query: url.searchParams.get("q") || "",
  }
}

async function loadLeads() {
  try {
    const { getStore } = await import("@netlify/blobs")
    const blobs = getStore("ash-leads") as unknown as BlobStore
    const { blobs: keys } = await blobs.list()
    const rows = await Promise.all(
      keys.map(async ({ key }) => {
        const value = await blobs.get(key, { type: "json" })
        return value && typeof value === "object" ? (value as Lead) : null
      }),
    )
    return sortLeads(rows.filter((item): item is Lead => Boolean(item?.id)))
  } catch {
    return []
  }
}

function eventOf(kind: HermesEvent["kind"], text: string, caseId?: string): HermesEvent {
  return { id: newEventId(), at: new Date().toISOString(), kind, text, caseId }
}

async function loadDesk() {
  const ledger = await readHermesLedger()
  const cases = liveCases(await readHermesCases({ includeGone: true }), ledger)
  const leads = await loadLeads()
  return { cases, leads, ledger }
}

async function persistCase(item: HermesCase) {
  const ok = await writeHermesCase(item)
  if (!ok) throw new Error("persist")
}

async function persistLedger(ledger: Awaited<ReturnType<typeof readHermesLedger>>) {
  const ok = await writeHermesLedger(ledger)
  if (!ok) throw new Error("persist")
}

async function payload(filter?: HermesDeskFilter) {
  const env = envBag()
  const { cases, leads } = await loadDesk()
  return decorateDeskPayload({
    cases,
    coach: await readHermesCoach(),
    events: await readHermesEvents(),
    memory: await readHermesMemory(),
    health: await readHermesHealth(),
    link: hermesLinkInfo(env),
    hermesReady: hermesReady(env),
    attachable: publicAttachable(attachableLeads(cases, leads)),
    inquiry: await readInquiryState(),
    filter,
  })
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true })
  if (!isStaff(req)) return json({ error: "unauthorized" }, 401)

  if (req.method === "GET") {
    const url = new URL(req.url)
    const asset = url.searchParams.get("asset") || ""
    if (asset.startsWith("img-")) {
      const image = await readHermesImage(asset)
      if (!image) return json({ error: "missing" }, 404)
      const bytes = Buffer.from(image.data, "base64")
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": image.mime,
          "Cache-Control": "private, max-age=3600",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }
    return json(await payload(asFilter(url)))
  }

  if (req.method !== "POST") return json({ error: "method" }, 405)

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ error: "bad-json" }, 400)
  }

  const action = typeof body.action === "string" ? body.action : ""
  if (action && !isStaffAction(action)) {
    return json({ error: "hermes-only" }, 403)
  }
  try {
  let { cases, ledger } = await loadDesk()
  const now = new Date().toISOString()

  if (action === "health") {
    const health = await probeHermes(envBag())
    const prev = await readHermesHealth()
    await writeHermesHealth(health)
    if (prev?.status !== health.status) {
      await appendHermesEvent(
        eventOf(
          "health",
          health.status === "connected"
            ? "网关探测：正常连接"
            : `网关探测：断开连接${health.detail ? `（${health.detail}）` : ""}`,
        ),
      )
    }
    return json({ ...(await payload()), health })
  }

  if (action === "targets") {
    const inquiry = await readInquiryState()
    const next = applyTargetWrite(inquiry.targets, body, now)
    if (next.error === "empty") return json({ error: "empty" }, 400)
    await writeInquiryState({ ...inquiry, targets: next.targets })
    await appendHermesEvent(eventOf("update", "询单：更新要找的厂商弊端"))
    return json(await payload())
  }

  if (action === "job") {
    const inquiry = await readInquiryState()
    const next = applyStaffJob(inquiry.job, inquiry.targets, body.status, now)
    if (next.error === "empty") return json({ error: "empty" }, 400)
    if (next.error === "hermes-only") return json({ error: "hermes-only" }, 403)
    await writeInquiryState({ ...inquiry, job: next.job })
    await appendHermesEvent(eventOf("update", `询单：${next.job.status}`))
    return json(await payload())
  }

  if (action === "file") {
    const findingId = typeof body.findingId === "string" ? body.findingId : ""
    const inquiry = await readInquiryState()
    const result = fileFinding(inquiry, cases, findingId, now)
    if (result.error) return json({ error: result.error }, 400)
    await writeInquiryState(result.inquiry)
    if (result.case) await persistCase(result.case)
    await appendHermesEvent(eventOf("update", `询单：建档 ${result.case?.org || ""}`.trim(), result.case?.id))
    return json(await payload())
  }

  if (action === "attach") {
    const leadId = typeof body.leadId === "string" ? body.leadId : ""
    const leads = await loadLeads()
    const result = attachLead(cases, leads, leadId, now, ledger)
    if (result.error === "missing") return json({ error: "missing" }, 400)
    if (result.case && result.error !== "exists") {
      await persistCase(result.case)
      await persistLedger(result.ledger)
    }
    await appendHermesEvent(eventOf("update", `接入线索 ${result.case?.name || leadId}`, result.case?.id))
    return json(await payload())
  }

  if (action === "import") {
    const leads = await loadLeads()
    const next = importLeads(cases, leads, now, ledger)
    for (const item of next) {
      if (!cases.some((row) => row.id === item.id)) await persistCase(item)
    }
    await appendHermesEvent(eventOf("update", `接入前台线索 ${Math.max(0, next.length - cases.length)} 条`))
    return json(await payload())
  }

  if (action === "cases") {
    const op = typeof body.op === "string" ? body.op : ""
    if (op === "delete") {
      const ids = Array.isArray(body.ids) ? body.ids.filter((item): item is string => typeof item === "string") : []
      const result = applyStaffCasesDelete(cases, ids, now)
      if (result.error) return json({ error: result.error }, 400)
      let nextLedger = ledger
      for (const item of result.gone) {
        await persistCase(item)
        nextLedger = markGoneOnLedger(nextLedger, item, now)
      }
      await persistLedger(nextLedger)
      await appendHermesEvent(eventOf("update", `删除 ${result.count} 张工单`))
      return json(await payload())
    }
    if (op === "update") {
      const id = typeof body.id === "string" ? body.id : ""
      const patch = body.patch && typeof body.patch === "object" ? (body.patch as Record<string, unknown>) : body
      const result = applyStaffCaseUpdate(cases, id, patch, now)
      if (result.error === "empty") return json({ error: "empty" }, 400)
      if (result.error === "missing") return json({ error: "missing" }, 404)
      if (result.case) await persistCase(result.case)
      await appendHermesEvent(eventOf("update", `编辑工单 ${result.case?.name || id}`, result.case?.id))
      return json(await payload())
    }
    if (op === "batch") {
      const ids = Array.isArray(body.ids) ? body.ids.filter((item): item is string => typeof item === "string") : []
      const patch = body.patch && typeof body.patch === "object" ? (body.patch as Record<string, unknown>) : {}
      const result = applyStaffCasesBatch(cases, ids, patch, now)
      if (result.error) return json({ error: result.error }, 400)
      for (const item of result.cases.filter((row) => ids.includes(row.id))) await persistCase(item)
      await appendHermesEvent(eventOf("update", `批量编辑 ${result.count} 张工单`))
      return json(await payload())
    }
    return json({ error: "op" }, 400)
  }

  if (action === "coach-clear") {
    await writeHermesCoach([])
    await appendHermesEvent(eventOf("update", "清空工作台对话"))
    return json(await payload())
  }

  if (action === "coach") {
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : ""
    const images = sanitizeCoachImages(body.images)
    if (!message && !images.length) return json({ error: "empty" }, 400)
    for (const image of images) {
      await writeHermesImage(image.id, { mime: image.mime, name: image.name, data: image.data })
    }
    const staff: HermesCoachTurn = {
      id: newCoachTurnId(),
      at: now,
      role: "staff",
      content: message || "（附图）",
      images: images.map(({ id, mime, name }) => ({ id, mime, name })),
    }
    const history = [...(await readHermesCoach()), staff]
    const memory = (await readHermesMemory()) || emptyMemory()
    const inquiry = await readInquiryState()
    const coachResult = await resolveCoachReply(
      cases,
      history,
      envBag(),
      memory,
      images.map(({ mime, data }) => ({ mime, data })),
      inquiry,
    )
    const replyTurn: HermesCoachTurn = {
      id: newCoachTurnId(Date.now() + 1),
      at: new Date().toISOString(),
      role: "hermes",
      content: coachResult.reply,
    }
    const coach = [...history, replyTurn]
    await writeHermesCoach(coach)
    if (coachResult.memory && JSON.stringify(coachResult.memory) !== JSON.stringify(memory)) {
      await writeHermesMemory(coachResult.memory)
    }
    for (const item of coachResult.cases) {
      const before = cases.find((row) => row.id === item.id)
      if (!before || JSON.stringify(before) !== JSON.stringify(item)) await writeHermesCase(item)
    }
    if (coachResult.inquiry && JSON.stringify(coachResult.inquiry) !== JSON.stringify(inquiry)) {
      await writeInquiryState(coachResult.inquiry)
    }
    await appendHermesEvent(eventOf("coach", (message || "附图").slice(0, 180)))
    return json({ ...(await payload()), coach, reply: coachResult.reply })
  }

  return json({ error: "action" }, 400)
  } catch (err) {
    if (err instanceof Error && err.message === "persist") return json({ error: "persist" }, 503)
    throw err
  }
}

export const config: Config = {
  method: ["GET", "POST", "OPTIONS"],
}
