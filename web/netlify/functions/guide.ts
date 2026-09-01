import type { Config, Context } from "@netlify/functions"
import { defaultContent } from "../../src/cms/defaultContent"
import {
  buildGreeting,
  buildGreetingEn,
  chinesePlace,
  englishPlace,
  replyLang,
  visitorLang,
} from "../../src/cms/greeting"
import { resolveGuideReply } from "../../src/cms/guideRuntime"
import { hermesHandoffHint, hermesReady, type AdvisorId } from "../../src/cms/hermes"
import { flattenKnowledge } from "../../src/cms/knowledge"
import { newLeadId, type Lead } from "../../src/cms/leads"
import { mergeContent } from "../../src/cms/merge"
import type { TicketDraft } from "../../src/cms/ticket"
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
    HERMES_API_BASE: readEnv("HERMES_API_BASE"),
    HERMES_API_KEY: readEnv("HERMES_API_KEY"),
    HERMES_MODEL: readEnv("HERMES_MODEL"),
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

async function fileTicket(ticket: TicketDraft, place: string | null) {
  try {
    const { getStore } = await import("@netlify/blobs")
    const blobs = getStore("ash-leads")
    const lead: Lead = {
      id: newLeadId(),
      at: new Date().toISOString(),
      name: ticket.name || "AI 对话客户",
      org: ticket.org,
      email: ticket.contact.includes("@") ? ticket.contact : "",
      contact: ticket.contact,
      note: ticket.note,
      place: place ?? undefined,
      source: "ai",
    }
    await blobs.setJSON(lead.id, lead)
    return true
  } catch {
    return false
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

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return json({ ok: true })
  if (req.method !== "POST") return json({ error: "method" }, 405)

  let body: { messages?: unknown; greet?: unknown; escalate?: unknown; advisor?: unknown; hermes?: unknown } = {}
  try {
    body = (await req.json()) as {
      messages?: unknown
      greet?: unknown
      escalate?: unknown
      advisor?: unknown
      hermes?: unknown
    }
  } catch {
    return json({ error: "bad-json" }, 400)
  }

  if (body.hermes === "status") {
    return json({ ready: hermesReady(envBag()) })
  }

  if (body.greet === true) {
    const geo = context.geo
    const lang = visitorLang(geo?.country?.code)
    const reply =
      lang === "en"
        ? buildGreetingEn(englishPlace(geo?.country?.code))
        : buildGreeting(chinesePlace(geo?.country?.code, geo?.subdivision?.name))
    return json({ reply, source: "greeting", lang, hermesReady: hermesReady(envBag()) })
  }

  const history = asMessages(body.messages)
  const escalate = body.escalate === true
  const advisor: AdvisorId = body.advisor === "hermes" || escalate ? "hermes" : "lin"
  if (!escalate && !history.some((item) => item.role === "user")) return json({ error: "empty" }, 400)

  const content = await publishedContent()
  const geo = context.geo
  const geoLang = visitorLang(geo?.country?.code)
  const placeZh = chinesePlace(geo?.country?.code, geo?.subdivision?.name)
  const lastUser = [...history].reverse().find((item) => item.role === "user")
  const lang = replyLang(geoLang, lastUser?.content)
  const place = lang === "en" ? englishPlace(geo?.country?.code) || "overseas" : placeZh || "国内"
  const langHint =
    lang === "en"
      ? `Visitor location: ${place}. The customer's latest message is in English. You MUST answer this turn in natural English.`
      : `访客位置：${place}。客户最后一条消息是中文。本轮必须全程用简体中文回答，不要夹英文段落。`
  const extra = escalate ? `${langHint}\n${hermesHandoffHint(lang)}` : langHint
  const result = await resolveGuideReply(history, flattenKnowledge(content), envBag(), extra, {
    advisor,
    escalate,
    lang,
  })
  let ticketFiled = false
  if (result.ticket) {
    ticketFiled = await fileTicket(result.ticket, placeZh)
  }
  return json({
    reply: result.reply,
    source: result.source,
    ticket: ticketFiled,
    lang,
    advisor: result.advisor,
    hermesReady: hermesReady(envBag()),
  })
}

export const config: Config = {
  method: ["POST", "OPTIONS"],
}
