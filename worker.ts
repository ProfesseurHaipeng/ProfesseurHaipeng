import { defaultContent } from "./web/src/cms/defaultContent"
import { buildGreeting, buildGreetingEn, chinesePlace, englishPlace, visitorLang } from "./web/src/cms/greeting"
import { resolveGuideReply } from "./web/src/cms/guideRuntime"
import { flattenKnowledge } from "./web/src/cms/knowledge"
import type { GuideMessage } from "./web/src/cms/guidePrompt"

export interface Env {
  ASSETS: { fetch: typeof fetch }
  MINIMAX_API_KEY?: string
  MINIMAX_API_BASE?: string
  MINIMAX_MODEL?: string
  MINIMAX_GROUP_ID?: string
  ASH_AI_BASE_URL?: string
  ASH_AI_API_KEY?: string
  ASH_AI_MODEL?: string
}

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors })
}

function asMessages(raw: unknown): GuideMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const row = item as { role?: unknown; content?: string }
      if (row.role !== "user" && row.role !== "assistant") return null
      if (typeof row.content !== "string") return null
      return { role: row.role, content: row.content.slice(0, 4000) }
    })
    .filter((item): item is GuideMessage => Boolean(item))
    .slice(-12)
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (url.pathname === "/api/guide" || url.pathname.endsWith("/api/guide")) {
      if (request.method === "OPTIONS") return json({ ok: true })
      if (request.method !== "POST") return json({ error: "method" }, 405)
      let body: { messages?: unknown; greet?: unknown } = {}
      try {
        body = (await request.json()) as { messages?: unknown; greet?: unknown }
      } catch {
        return json({ error: "bad-json" }, 400)
      }
      if (body.greet === true) {
        const cf = (request as Request & { cf?: { country?: string; region?: string } }).cf
        const lang = visitorLang(cf?.country)
        const reply =
          lang === "en" ? buildGreetingEn(englishPlace(cf?.country)) : buildGreeting(chinesePlace(cf?.country, cf?.region))
        return json({ reply, source: "greeting", lang })
      }
      const history = asMessages(body.messages)
      if (!history.some((item) => item.role === "user")) return json({ error: "empty" }, 400)
      const result = await resolveGuideReply(history, flattenKnowledge(defaultContent), {
        MINIMAX_API_KEY: env.MINIMAX_API_KEY,
        MINIMAX_API_BASE: env.MINIMAX_API_BASE,
        MINIMAX_MODEL: env.MINIMAX_MODEL,
        MINIMAX_GROUP_ID: env.MINIMAX_GROUP_ID,
        ASH_AI_BASE_URL: env.ASH_AI_BASE_URL,
        ASH_AI_API_KEY: env.ASH_AI_API_KEY,
        ASH_AI_MODEL: env.ASH_AI_MODEL,
      })
      // Workers have no lead store; drop the ticket but keep the clean reply.
      return json({ reply: result.reply, source: result.source })
    }
    return env.ASSETS.fetch(request)
  },
}
