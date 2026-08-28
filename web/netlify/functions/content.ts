import type { Config } from "@netlify/functions"
import { mergeContent } from "../../src/cms/merge"
import { isSiteContent } from "../../src/cms/validate"

type BlobStore = {
  get: (key: string, options: { type: "json" }) => Promise<unknown>
  setJSON: (key: string, value: unknown) => Promise<void>
}

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors })

async function store(): Promise<BlobStore | null> {
  try {
    const { getStore } = await import("@netlify/blobs")
    return getStore("ash-cms") as BlobStore
  } catch {
    return null
  }
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true })
  }

  const blobs = await store()

  if (req.method === "GET") {
    if (!blobs) return json({ error: "no-store" }, 404)
    const published = await blobs.get("site", { type: "json" })
    if (!published) return json({ error: "empty" }, 404)
    if (!isSiteContent(published)) return json({ error: "invalid" }, 404)
    return json(mergeContent(published))
  }

  if (req.method === "PUT") {
    const password = (typeof Netlify === "undefined" ? process.env.ADMIN_PASSWORD : Netlify.env.get("ADMIN_PASSWORD")) || "ash-draft"
    let payload: { password?: string; content?: unknown } = {}
    try {
      payload = (await req.json()) as { password?: string; content?: unknown }
    } catch {
      return json({ error: "bad-json" }, 400)
    }
    if (payload.password !== password) {
      return json({ error: "unauthorized" }, 401)
    }
    if (!isSiteContent(payload.content)) {
      return json({ error: "invalid-content" }, 400)
    }
    if (!blobs) return json({ error: "no-store" }, 503)
    const content = mergeContent(payload.content)
    await blobs.setJSON("site", content)
    return json({ ok: true, updatedAt: content.updatedAt })
  }

  return json({ error: "method" }, 405)
}

export const config: Config = {
  method: ["GET", "PUT", "OPTIONS"],
}
