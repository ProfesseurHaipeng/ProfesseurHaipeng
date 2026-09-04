import { createHmac } from "node:crypto"
import { advisorConversationIdentity } from "../src/cms/advisorIdentity"
import { defaultContent } from "../src/cms/defaultContent"
import { buildGreeting, chinesePlace, replyLang, visitorLang } from "../src/cms/greeting"
import { resolveGuideReply } from "../src/cms/guideRuntime"
import { hermesHandoffHint, hermesReady, type AdvisorId } from "../src/cms/hermes"
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
    SENIOR_ADVISOR_API_BASE: process.env.SENIOR_ADVISOR_API_BASE || "",
    SENIOR_ADVISOR_API_KEY: process.env.SENIOR_ADVISOR_API_KEY || "",
    SENIOR_ADVISOR_MODEL: process.env.SENIOR_ADVISOR_MODEL || "",
    HERMES_API_BASE: process.env.HERMES_API_BASE || "",
    HERMES_API_KEY: process.env.HERMES_API_KEY || "",
    HERMES_MODEL: process.env.HERMES_MODEL || "",
    ADVISOR_CASE_ID_SECRET: process.env.ADVISOR_CASE_ID_SECRET || "",
    PROJECT_IDENTITY_DENYLIST: process.env.PROJECT_IDENTITY_DENYLIST || "",
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

  let body: {
    messages?: unknown
    greet?: unknown
    escalate?: unknown
    advisor?: unknown
    hermes?: unknown
    visitorId?: unknown
  } = {}
  try {
    body = (await req.json()) as {
      messages?: unknown
      greet?: unknown
      escalate?: unknown
      advisor?: unknown
      hermes?: unknown
      visitorId?: unknown
    }
  } catch {
    return json({ error: "bad-json" }, 400)
  }

  const env = envBag()
  if (body.hermes === "status") {
    return json({ ready: hermesReady(env) })
  }

  if (body.greet === true) {
    const place = chinesePlace(req.headers.get("x-vercel-ip-country"), req.headers.get("x-vercel-ip-country-region"))
    return json({ reply: buildGreeting(place), source: "greeting", hermesReady: hermesReady(env) })
  }

  const history = asMessages(body.messages)
  const escalate = body.escalate === true
  const advisor: AdvisorId = body.advisor === "hermes" || escalate ? "hermes" : "lin"
  if (!escalate && !history.some((item) => item.role === "user")) return json({ error: "empty" }, 400)

  const lastUser = [...history].reverse().find((item) => item.role === "user")
  const lang = replyLang(visitorLang(req.headers.get("x-vercel-ip-country")), lastUser?.content)
  const extra = escalate ? hermesHandoffHint(lang) : undefined
  const visitorId = typeof body.visitorId === "string" ? body.visitorId.trim() : ""
  const conversationId = advisorConversationIdentity(visitorId || "anon-front", env.ADVISOR_CASE_ID_SECRET)
  const signature = env.ADVISOR_CASE_ID_SECRET
    ? createHmac("sha256", env.ADVISOR_CASE_ID_SECRET).update(conversationId).digest("hex")
    : ""
  const result = await resolveGuideReply(history, flattenKnowledge(defaultContent), env, extra, {
    advisor,
    escalate,
    lang,
    conversationId,
    identityHeaders: signature
      ? {
          "X-Advisor-Signature": signature,
          "X-Advisor-Case-Signature": signature,
          "X-Case-Signature": signature,
        }
      : undefined,
  })
  return json({
    reply: result.reply,
    source: result.source,
    advisor: result.advisor,
    hermesReady: hermesReady(env),
    reconnecting: result.reconnecting === true,
  })
}
