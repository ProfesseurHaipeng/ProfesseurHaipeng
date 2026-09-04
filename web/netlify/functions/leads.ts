import type { Config, Context } from "@netlify/functions"
import { chinesePlace } from "../../src/cms/greeting"
import { newLeadId, sanitizeLead, sortLeads, type Lead } from "../../src/cms/leads"

type LeadStore = {
  get: (key: string, options: { type: "json" }) => Promise<unknown>
  setJSON: (key: string, value: unknown) => Promise<void>
  delete: (key: string) => Promise<void>
  list: () => Promise<{ blobs: { key: string }[] }>
}

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Admin-User,X-Admin-Pass",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors })

async function store(): Promise<LeadStore | null> {
  try {
    const { getStore } = await import("@netlify/blobs")
    return getStore("ash-leads") as unknown as LeadStore
  } catch {
    return null
  }
}

function readEnv(name: string) {
  try {
    const fromNetlify = typeof Netlify === "undefined" ? undefined : Netlify.env.get(name)
    return fromNetlify || process.env[name] || ""
  } catch {
    return process.env[name] || ""
  }
}

function isStaff(req: Request) {
  const user = readEnv("ADMIN_USER") || "admin"
  const pass = readEnv("ADMIN_PASSWORD") || "ash-draft"
  return req.headers.get("x-admin-user") === user && req.headers.get("x-admin-pass") === pass
}

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return json({ ok: true })

  const blobs = await store()
  if (!blobs) return json({ error: "no-store" }, 503)

  if (req.method === "POST") {
    let payload: unknown = null
    try {
      payload = await req.json()
    } catch {
      return json({ error: "bad-json" }, 400)
    }
    const input = sanitizeLead(payload)
    if (!input) return json({ error: "invalid" }, 400)
    const geo = context.geo
    const lead: Lead = {
      ...input,
      id: newLeadId(),
      at: new Date().toISOString(),
      place: chinesePlace(geo?.country?.code, geo?.subdivision?.name) ?? undefined,
    }
    await blobs.setJSON(lead.id, lead)
    return json({ ok: true, id: lead.id })
  }

  if (!isStaff(req)) return json({ error: "unauthorized" }, 401)

  if (req.method === "GET") {
    const { blobs: keys } = await blobs.list()
    const leads = (
      await Promise.all(
        keys.map(async ({ key }) => {
          const value = await blobs.get(key, { type: "json" })
          return value && typeof value === "object" ? (value as Lead) : null
        }),
      )
    ).filter((item): item is Lead => Boolean(item?.id))
    return json({ leads: sortLeads(leads) })
  }

  if (req.method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id") || ""
    if (!id.startsWith("lead-")) return json({ error: "bad-id" }, 400)
    await blobs.delete(id)
    return json({ ok: true })
  }

  return json({ error: "method" }, 405)
}

export const config: Config = {
  method: ["GET", "POST", "DELETE", "OPTIONS"],
}
