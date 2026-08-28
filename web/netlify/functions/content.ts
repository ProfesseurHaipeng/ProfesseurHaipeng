import type { Handler } from "@netlify/functions"
import { mergeContent } from "../../src/cms/merge"
import { isSiteContent } from "../../src/cms/validate"

type BlobStore = {
  get: (key: string, options: { type: "json" }) => Promise<unknown>
  setJSON: (key: string, value: unknown) => Promise<void>
}

const json = (body: unknown, status = 200) => ({
  statusCode: status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  },
  body: JSON.stringify(body),
})

async function store(): Promise<BlobStore | null> {
  try {
    const { getStore } = await import("@netlify/blobs")
    return getStore("ash-cms") as BlobStore
  } catch {
    return null
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json({ ok: true })
  }

  const blobs = await store()

  if (event.httpMethod === "GET") {
    if (!blobs) return json({ error: "no-store" }, 404)
    const published = await blobs.get("site", { type: "json" })
    if (!published) return json({ error: "empty" }, 404)
    if (!isSiteContent(published)) return json({ error: "invalid" }, 404)
    return json(mergeContent(published))
  }

  if (event.httpMethod === "PUT") {
    const password = process.env.ADMIN_PASSWORD || "ash-draft"
    let payload: { password?: string; content?: unknown } = {}
    try {
      payload = event.body ? JSON.parse(event.body) : {}
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
