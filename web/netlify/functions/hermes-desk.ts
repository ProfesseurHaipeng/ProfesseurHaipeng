import type { Config } from "@netlify/functions"
import { hermesLinkInfo, hermesReady, probeHermes } from "../../src/cms/hermes"
import {
  appendHermesEvent,
  deleteHermesCase,
  readHermesCases,
  readHermesCoach,
  readHermesEvents,
  readHermesHealth,
  readHermesMemory,
  writeHermesCase,
  writeHermesCoach,
  writeHermesHealth,
  writeHermesMemory,
} from "../../src/cms/hermesBlobs"
import {
  applyResume,
  applyTakeover,
  attachableLeads,
  attachLead,
  decorateDeskPayload,
  emptyMemory,
  importLeads,
  newCoachTurnId,
  newEventId,
  patchHermesCase,
  pruneUnspokenCases,
  publicAttachable,
  resolveCoachReply,
  sortHermesCases,
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
 *   health | coach | takeover | resume | update | memory | note | attach | prune | sync
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

async function payload(filter?: HermesDeskFilter) {
  const env = envBag()
  const cases = await readHermesCases()
  const leads = await loadLeads()
  return decorateDeskPayload({
    cases,
    coach: await readHermesCoach(),
    events: await readHermesEvents(),
    memory: await readHermesMemory(),
    health: await readHermesHealth(),
    link: hermesLinkInfo(env),
    hermesReady: hermesReady(env),
    attachable: publicAttachable(attachableLeads(cases, leads)),
    filter,
  })
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true })
  if (!isStaff(req)) return json({ error: "unauthorized" }, 401)

  if (req.method === "GET") {
    return json(await payload(asFilter(new URL(req.url))))
  }

  if (req.method !== "POST") return json({ error: "method" }, 405)

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ error: "bad-json" }, 400)
  }

  const action = typeof body.action === "string" ? body.action : ""
  let cases = await readHermesCases()
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

  if (action === "sync") {
    const next = importLeads(cases, await loadLeads(), now)
    let added = 0
    for (const item of next) {
      if (!cases.some((row) => row.id === item.id)) {
        await writeHermesCase(item)
        added += 1
      }
    }
    if (added) await appendHermesEvent(eventOf("attach", `同步了 ${added} 条 AI 工单`))
    return json(await payload())
  }

  if (action === "prune") {
    const next = pruneUnspokenCases(cases)
    const removed = cases.filter((item) => !next.some((row) => row.id === item.id))
    for (const item of removed) await deleteHermesCase(item.id)
    if (removed.length) {
      await appendHermesEvent(eventOf("note", `清理了 ${removed.length} 条没有真实对话的表单卡`))
    }
    return json({ ...(await payload()), removed: removed.length })
  }

  if (action === "memory") {
    const current = await readHermesMemory()
    const next = {
      shared: typeof body.shared === "string" ? body.shared.trim().slice(0, 8000) : current.shared,
      desk: typeof body.desk === "string" ? body.desk.trim().slice(0, 8000) : current.desk,
      updatedAt: now,
    }
    await writeHermesMemory(next)
    await appendHermesEvent(eventOf("note", "更新了长期记忆或工作台笔记"))
    return json({ ...(await payload()), memory: next })
  }

  if (action === "attach") {
    const leadId = typeof body.leadId === "string" ? body.leadId : ""
    const result = attachLead(cases, await loadLeads(), leadId, now)
    if (result.error === "missing" || result.error === "not-ai") {
      return json({ error: result.error }, 400)
    }
    if (result.case && result.error !== "exists") {
      await writeHermesCase(result.case)
      await appendHermesEvent(eventOf("attach", `接入 AI 工单 ${result.case.name}`, result.case.id))
    }
    return json({ ...(await payload()), case: result.case })
  }

  const id = typeof body.id === "string" ? body.id : ""
  const current = cases.find((item) => item.id === id)

  if (action === "note") {
    const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim().slice(0, 2000) : ""
    if (!current) return json({ error: "missing" }, 404)
    if (!text) return json({ error: "empty" }, 400)
    await appendHermesEvent(eventOf("note", text, current.id))
    return json(await payload())
  }

  if (action === "takeover" || action === "resume" || action === "update") {
    if (!current) return json({ error: "missing" }, 404)
    const next =
      action === "takeover"
        ? applyTakeover(current, now)
        : action === "resume"
          ? applyResume(current, now)
          : patchHermesCase(current, body, now)
    await writeHermesCase(next)
    cases = sortHermesCases([next, ...cases.filter((item) => item.id !== next.id)])
    await appendHermesEvent(
      eventOf(
        action === "update" ? "update" : action,
        action === "takeover" ? `人工接管 ${next.name}` : action === "resume" ? `交回 Hermes ${next.name}` : `更新档案 ${next.name}`,
        next.id,
      ),
    )
    return json({ ...(await payload()), case: next })
  }

  if (action === "coach") {
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : ""
    if (!message) return json({ error: "empty" }, 400)
    const staff: HermesCoachTurn = {
      id: newCoachTurnId(),
      at: now,
      role: "staff",
      content: message,
    }
    const history = [...(await readHermesCoach()), staff]
    const memory = (await readHermesMemory()) || emptyMemory()
    const coachResult = await resolveCoachReply(cases, history, envBag(), memory)
    const replyTurn: HermesCoachTurn = {
      id: newCoachTurnId(Date.now() + 1),
      at: new Date().toISOString(),
      role: "hermes",
      content: coachResult.reply,
    }
    const coach = [...history, replyTurn]
    await writeHermesCoach(coach)
    for (const item of coachResult.cases) {
      const before = cases.find((row) => row.id === item.id)
      if (!before || JSON.stringify(before) !== JSON.stringify(item)) await writeHermesCase(item)
    }
    await appendHermesEvent(eventOf("coach", message.slice(0, 180)))
    return json({ ...(await payload()), coach, reply: coachResult.reply })
  }

  return json({ error: "action" }, 400)
}

export const config: Config = {
  method: ["GET", "POST", "OPTIONS"],
}
