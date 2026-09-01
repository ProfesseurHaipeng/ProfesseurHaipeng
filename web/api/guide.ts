import { defaultContent } from "../src/cms/defaultContent"
import { buildGreeting, chinesePlace } from "../src/cms/greeting"
import { resolveGuideReply } from "../src/cms/guideRuntime"
import { flattenKnowledge } from "../src/cms/knowledge"
import type { GuideMessage } from "../src/cms/guidePrompt"

export const config = { runtime: "edge" }

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors })

function envBag() {
  return {
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY || "",
    MINIMAX_API_BASE: process.env.MINIMAX_API_BASE || "",
    MINIMAX_MODEL: process.env.MINIMAX_MODEL || "",
    MINIMAX_GROUP_ID: process.env.MINIMAX_GROUP_ID || "",
    ASH_AI_BASE_URL: process.env.ASH_AI_BASE_URL || "",
    ASH_AI_API_KEY: process.env.ASH_AI_API_KEY || "",
    ASH_AI_MODEL: process.env.ASH_AI_MODEL || "",
  }
}

function asMessages(raw: unknown): GuideMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const row = item as { role?: unknown; content?: unknown }
      if (row.role !== "user" && row.role !== "assistant") return null
      if (typeof row.content !== "string") return null
      return { role: row.role, content: row.content.slice(0, 4000) }
    })
    .filter((item): item is GuideMessage => Boolean(item))
    .slice(-12)
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true })
  if (req.method !== "POST") return json({ error: "method" }, 405)

  let body: { messages?: unknown; greet?: unknown } = {}
  try {
    body = (await req.json()) as { messages?: unknown; greet?: unknown }
  } catch {
    return json({ error: "bad-json" }, 400)
  }

  if (body.greet === true) {
    const place = chinesePlace(req.headers.get("x-vercel-ip-country"), req.headers.get("x-vercel-ip-country-region"))
    return json({ reply: buildGreeting(place), source: "greeting" })
  }

  const history = asMessages(body.messages)
  if (!history.some((item) => item.role === "user")) return json({ error: "empty" }, 400)

  const result = await resolveGuideReply(history, flattenKnowledge(defaultContent), envBag())
  return json(result)
}
