import type { Config } from "@netlify/functions"
import {
  readHermesCases,
  readHermesCoach,
  writeHermesCase,
  writeHermesCoach,
} from "../../src/cms/hermesBlobs"
import {
  applyResume,
  applyTakeover,
  filterHermesCases,
  importLeads,
  newCoachTurnId,
  patchHermesCase,
  resolveCoachReply,
  sortHermesCases,
  type HermesCoachTurn,
  type HermesDeskFilter,
} from "../../src/cms/hermesDesk"
import { hermesReady } from "../../src/cms/hermes"
import { sortLeads, type Lead } from "../../src/cms/leads"

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
  return {
    follow: follow === "following" || follow === "idle" ? follow : "all",
    owner: owner === "hermes" || owner === "human" ? owner : "all",
    energy: energy === "high" || energy === "mid" || energy === "low" ? energy : "all",
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

export default async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true })
  if (!isStaff(req)) return json({ error: "unauthorized" }, 401)

  if (req.method === "GET") {
    const url = new URL(req.url)
    return json({
      cases: filterHermesCases(await readHermesCases(), asFilter(url)),
      coach: await readHermesCoach(),
      hermesReady: hermesReady(envBag()),
    })
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

  if (action === "sync") {
    const next = importLeads(cases, await loadLeads(), now)
    for (const item of next) {
      if (!cases.some((row) => row.id === item.id)) await writeHermesCase(item)
    }
    return json({ cases: next, coach: await readHermesCoach(), hermesReady: hermesReady(envBag()) })
  }

  const id = typeof body.id === "string" ? body.id : ""
  const current = cases.find((item) => item.id === id)

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
    return json({ cases, case: next, hermesReady: hermesReady(envBag()) })
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
    const coachResult = await resolveCoachReply(cases, history, envBag())
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
    return json({
      cases: coachResult.cases,
      coach,
      reply: coachResult.reply,
      hermesReady: hermesReady(envBag()),
    })
  }

  return json({ error: "action" }, 400)
}

export const config: Config = {
  method: ["GET", "POST", "OPTIONS"],
}
