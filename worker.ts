import { defaultContent } from "./web/src/cms/defaultContent"
import {
  buildGreeting,
  buildGreetingEn,
  chinesePlace,
  englishPlace,
  replyLang,
  visitorLang,
} from "./web/src/cms/greeting"
import { resolveGuideReply } from "./web/src/cms/guideRuntime"
import { hermesHandoffHint, hermesReady, type AdvisorId } from "./web/src/cms/hermes"
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
  HERMES_API_BASE?: string
  HERMES_API_KEY?: string
  HERMES_MODEL?: string
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
      let body: { messages?: unknown; greet?: unknown; escalate?: unknown; advisor?: unknown; hermes?: unknown } = {}
      try {
        body = (await request.json()) as {
          messages?: unknown
          greet?: unknown
          escalate?: unknown
          advisor?: unknown
          hermes?: unknown
        }
      } catch {
        return json({ error: "bad-json" }, 400)
      }
      const bag = {
        MINIMAX_API_KEY: env.MINIMAX_API_KEY,
        MINIMAX_API_BASE: env.MINIMAX_API_BASE,
        MINIMAX_MODEL: env.MINIMAX_MODEL,
        MINIMAX_GROUP_ID: env.MINIMAX_GROUP_ID,
        ASH_AI_BASE_URL: env.ASH_AI_BASE_URL,
        ASH_AI_API_KEY: env.ASH_AI_API_KEY,
        ASH_AI_MODEL: env.ASH_AI_MODEL,
        HERMES_API_BASE: env.HERMES_API_BASE,
        HERMES_API_KEY: env.HERMES_API_KEY,
        HERMES_MODEL: env.HERMES_MODEL,
      }
      if (body.hermes === "status") {
        return json({ ready: hermesReady(bag) })
      }
      if (body.greet === true) {
        const cf = (request as Request & { cf?: { country?: string; region?: string } }).cf
        const lang = visitorLang(cf?.country)
        const reply =
          lang === "en" ? buildGreetingEn(englishPlace(cf?.country)) : buildGreeting(chinesePlace(cf?.country, cf?.region))
        return json({ reply, source: "greeting", lang, hermesReady: hermesReady(bag) })
      }
      const history = asMessages(body.messages)
      const escalate = body.escalate === true
      const advisor: AdvisorId = body.advisor === "hermes" || escalate ? "hermes" : "lin"
      if (!escalate && !history.some((item) => item.role === "user")) return json({ error: "empty" }, 400)
      const cf = (request as Request & { cf?: { country?: string } }).cf
      const lastUser = [...history].reverse().find((item) => item.role === "user")
      const turnLang = replyLang(visitorLang(cf?.country), lastUser?.content)
      const workerHint =
        turnLang === "en"
          ? "The customer's latest message is in English. You MUST answer this turn in natural English."
          : "客户最后一条消息是中文。本轮必须全程用简体中文回答。"
      const extra = escalate ? `${workerHint}\n${hermesHandoffHint(turnLang)}` : workerHint
      const result = await resolveGuideReply(history, flattenKnowledge(defaultContent), bag, extra, {
        advisor,
        escalate,
        lang: turnLang,
      })
      // Workers have no lead store; drop the ticket but keep the clean reply.
      return json({
        reply: result.reply,
        source: result.source,
        advisor: result.advisor,
        hermesReady: hermesReady(bag),
      })
    }
    return env.ASSETS.fetch(request)
  },
}
