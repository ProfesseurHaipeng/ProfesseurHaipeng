import type { Config, Context } from "@netlify/functions"
import { defaultContent } from "../../src/cms/defaultContent"
import { buildGreeting, chinesePlace } from "../../src/cms/greeting"
import { resolveGuideReply } from "../../src/cms/guideRuntime"
import { flattenKnowledge } from "../../src/cms/knowledge"
import { mergeContent } from "../../src/cms/merge"
import { isSiteContent } from "../../src/cms/validate"
import type { SiteContent } from "../../src/cms/types"
import type { GuideMessage } from "../../src/cms/guidePrompt"

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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
    MINIMAX_API_KEY: readEnv("MINIMAX_API_KEY"),
    MINIMAX_API_BASE: readEnv("MINIMAX_API_BASE"),
    MINIMAX_MODEL: readEnv("MINIMAX_MODEL"),
    MINIMAX_GROUP_ID: readEnv("MINIMAX_GROUP_ID"),
    ASH_AI_BASE_URL: readEnv("ASH_AI_BASE_URL"),
    ASH_AI_API_KEY: readEnv("ASH_AI_API_KEY"),
    ASH_AI_MODEL: readEnv("ASH_AI_MODEL"),
  }
}

async function publishedContent(): Promise<SiteContent> {
  try {
    const { getStore } = await import("@netlify/blobs")
    const blobs = getStore("ash-cms")
    const published = await blobs.get("site", { type: "json" })
    if (isSiteContent(published)) return mergeContent(published)
  } catch {
    /* use defaults */
  }
  return mergeContent(defaultContent)
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

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return json({ ok: true })
  if (req.method !== "POST") return json({ error: "method" }, 405)

  let body: { messages?: unknown; greet?: unknown } = {}
  try {
    body = (await req.json()) as { messages?: unknown; greet?: unknown }
  } catch {
    return json({ error: "bad-json" }, 400)
  }

  if (body.greet === true) {
    const geo = context.geo
    const place = chinesePlace(geo?.country?.code, geo?.subdivision?.name)
    return json({ reply: buildGreeting(place), source: "greeting" })
  }

  const history = asMessages(body.messages)
  if (!history.some((item) => item.role === "user")) return json({ error: "empty" }, 400)

  const content = await publishedContent()
  const result = await resolveGuideReply(history, flattenKnowledge(content), envBag())
  return json(result)
}

export const config: Config = {
  method: ["POST", "OPTIONS"],
}
