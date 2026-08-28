import type { Handler } from "@netlify/functions"

type BlobStore = {
  get: (key: string, options: { type: "json" }) => Promise<unknown>
  setJSON: (key: string, value: unknown) => Promise<void>
}

const json = (body: unknown, status = 200) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
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
  const blobs = await store()

  if (event.httpMethod === "GET") {
    if (!blobs) return json({ error: "no-store" }, 404)
    const published = await blobs.get("site", { type: "json" })
    if (!published) return json({ error: "empty" }, 404)
    return json(published)
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
    if (!payload.content || typeof payload.content !== "object") {
      return json({ error: "missing-content" }, 400)
    }
    if (!blobs) return json({ error: "no-store" }, 503)
    await blobs.setJSON("site", payload.content)
    return json({ ok: true })
  }

  return json({ error: "method" }, 405)
}
