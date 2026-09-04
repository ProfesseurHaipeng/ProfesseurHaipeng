import { createHmac } from "node:crypto"
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
import {
  readGuideChatSession,
  readGuideIpVisitor,
  readHermesCases,
  readHermesLedger,
  readHermesMemory,
  writeGuideChatSession,
  writeGuideIpVisitor,
  writeHermesCase,
} from "../../src/cms/hermesBlobs"
import { hashVisitorSignal, pickGuideVisitor, sessionAfterReply } from "../../src/cms/guideSession"
import { advisorConversationIdentity } from "../../src/cms/advisorIdentity"
import { hermesHandoffHint, hermesReady, type AdvisorId } from "../../src/cms/hermes"
import {
  findHermesCase,
  frontHermesExtra,
  humanTakenOverReply,
  isHumanOwned,
  isIdentitySuppressed,
  upsertFromTicket,
  upsertFromVisit,
} from "../../src/cms/hermesDesk"
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

function advisorSignatureHeaders(id: string, secret: string) {
  if (!secret) return {}
  const signature = createHmac("sha256", secret).update(id).digest("hex")
  return {
    "X-Advisor-Signature": signature,
    "X-Advisor-Case-Signature": signature,
    "X-Case-Signature": signature,
  }
}

function requestIp(req: Request, context: Context) {
  const fromContext = typeof (context as { ip?: string }).ip === "string" ? (context as { ip?: string }).ip : ""
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || ""
  const nf = req.headers.get("x-nf-client-connection-ip") || ""
  return (fromContext || nf || forwarded).trim()
}

async function resolveVisitor(req: Request, context: Context, clientVisitorId: string) {
  const ipHash = hashVisitorSignal(requestIp(req, context))
  const ipBind = ipHash ? await readGuideIpVisitor(ipHash) : null
  const picked = pickGuideVisitor({
    clientVisitorId,
    ipVisitorId: ipBind?.visitorId,
    ipAt: ipBind?.at,
  })
  return { ...picked, ipHash }
}

async function persistVisitorChat(options: {
  req: Request
  context: Context
  visitorId: string
  ipHash: string
  messages: unknown
  reply: string
  advisor: AdvisorId
  lang: "zh" | "en"
  handoffIndex?: unknown
  takenOver?: unknown
}) {
  if (!options.visitorId) return
  const session = sessionAfterReply(options.messages, options.reply, {
    visitorId: options.visitorId,
    advisor: options.advisor,
    lang: options.lang,
    handoffIndex: options.handoffIndex,
    takenOver: options.takenOver,
  })
  if (session) await writeGuideChatSession(session)
  if (options.ipHash) await writeGuideIpVisitor(options.ipHash, options.visitorId)
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
    SENIOR_ADVISOR_API_BASE: readEnv("SENIOR_ADVISOR_API_BASE"),
    SENIOR_ADVISOR_API_KEY: readEnv("SENIOR_ADVISOR_API_KEY"),
    SENIOR_ADVISOR_MODEL: readEnv("SENIOR_ADVISOR_MODEL"),
    HERMES_API_BASE: readEnv("HERMES_API_BASE"),
    HERMES_API_KEY: readEnv("HERMES_API_KEY"),
    HERMES_MODEL: readEnv("HERMES_MODEL"),
    ADVISOR_CASE_ID_SECRET: readEnv("ADVISOR_CASE_ID_SECRET"),
    SIGNED_GUIDE_FALLBACK: readEnv("SIGNED_GUIDE_FALLBACK"),
    PROJECT_IDENTITY_DENYLIST: readEnv("PROJECT_IDENTITY_DENYLIST"),
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

  let body: {
    messages?: unknown
    greet?: unknown
    escalate?: unknown
    advisor?: unknown
    hermes?: unknown
    visitorId?: unknown
    handoffIndex?: unknown
    takenOver?: unknown
  } = {}
  try {
    body = (await req.json()) as {
      messages?: unknown
      greet?: unknown
      escalate?: unknown
      advisor?: unknown
      hermes?: unknown
      visitorId?: unknown
      handoffIndex?: unknown
      takenOver?: unknown
    }
  } catch {
    return json({ error: "bad-json" }, 400)
  }

  if (body.hermes === "status") {
    return json({ ready: hermesReady(envBag()) })
  }

  if (body.greet === true) {
    const clientVisitorId = typeof body.visitorId === "string" ? body.visitorId.trim().slice(0, 80) : ""
    const resolved = await resolveVisitor(req, context, clientVisitorId)
    const stored = resolved.visitorId ? await readGuideChatSession(resolved.visitorId) : null
    if (stored) {
      return json({
        reply: "",
        source: "resume",
        lang: stored.lang,
        hermesReady: hermesReady(envBag()),
        resumed: true,
        visitorId: stored.visitorId,
        session: stored,
      })
    }
    const geo = context.geo
    const lang = visitorLang(geo?.country?.code)
    const reply =
      lang === "en"
        ? buildGreetingEn(englishPlace(geo?.country?.code))
        : buildGreeting(chinesePlace(geo?.country?.code, geo?.subdivision?.name))
    const visitorId = resolved.visitorId || clientVisitorId
    if (visitorId) {
      await persistVisitorChat({
        req,
        context,
        visitorId,
        ipHash: resolved.ipHash,
        messages: [],
        reply,
        advisor: "lin",
        lang,
      })
    }
    return json({
      reply,
      source: "greeting",
      lang,
      hermesReady: hermesReady(envBag()),
      visitorId,
    })
  }

  const history = asMessages(body.messages)
  const escalate = body.escalate === true
  const clientVisitorId = typeof body.visitorId === "string" ? body.visitorId.trim().slice(0, 80) : ""
  const resolved = await resolveVisitor(req, context, clientVisitorId)
  const visitorId = resolved.visitorId || clientVisitorId
  let advisor: AdvisorId = body.advisor === "hermes" || escalate ? "hermes" : "lin"
  if (!escalate && !history.some((item) => item.role === "user")) return json({ error: "empty" }, 400)

  const deskCases = await readHermesCases()
  if (advisor === "hermes" && isHumanOwned(deskCases, visitorId)) {
    const geoLang = visitorLang(context.geo?.country?.code)
    const lastUser = [...history].reverse().find((item) => item.role === "user")
    const lang = replyLang(geoLang, lastUser?.content)
    await persistVisitorChat({
      req,
      context,
      visitorId,
      ipHash: resolved.ipHash,
      messages: body.messages,
      reply: humanTakenOverReply(lang),
      advisor: "hermes",
      lang,
      handoffIndex: body.handoffIndex,
      takenOver: true,
    })
    return json({
      reply: humanTakenOverReply(lang),
      source: "local",
      ticket: false,
      lang,
      advisor: "hermes",
      hermesReady: hermesReady(envBag()),
      takenOver: true,
      visitorId,
    })
  }

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
  let extra = escalate ? `${langHint}\n${hermesHandoffHint(lang)}` : langHint
  if (advisor === "hermes") {
    extra = frontHermesExtra(await readHermesMemory(), findHermesCase(deskCases, { visitorId }), extra)
  }
  const env = envBag()
  const secret = env.ADVISOR_CASE_ID_SECRET.trim()
  const hashed = advisorConversationIdentity(visitorId || "anon-front", secret)
  const conversationIds = [...new Set([secret, secret && visitorId ? `${secret}:${visitorId}` : "", hashed].filter(Boolean))]
  const conversationId = conversationIds[0] || hashed
  const result = await resolveGuideReply(history, flattenKnowledge(content), env, extra, {
    advisor,
    escalate,
    lang,
    conversationId,
    conversationIds,
    identityHeaders: advisorSignatureHeaders(conversationId, secret),
    visitorId,
  })
  const ledger = await readHermesLedger()
  const identity = {
    visitorId: visitorId || undefined,
    contact: result.ticket?.contact,
  }
  const suppressed = isIdentitySuppressed(identity, ledger)
  let ticketFiled = false
  if (result.ticket && !suppressed) {
    ticketFiled = await fileTicket(result.ticket, placeZh)
  }
  if (result.advisor === "hermes" && !suppressed) {
    const seeded = visitorId
      ? upsertFromVisit(deskCases, visitorId, lastUser?.content || result.ticket?.note || "", undefined, ledger)
      : { cases: deskCases, case: null }
    const withTicket = result.ticket
      ? upsertFromTicket(
          seeded.cases,
          result.ticket,
          {
            visitorId: visitorId || undefined,
            place: placeZh || undefined,
            following: true,
          },
          undefined,
          ledger,
        )
      : seeded
    if (withTicket.case) await writeHermesCase(withTicket.case)
  }
  await persistVisitorChat({
    req,
    context,
    visitorId,
    ipHash: resolved.ipHash,
    messages: body.messages,
    reply: result.reply,
    advisor: result.advisor,
    lang,
    handoffIndex: body.handoffIndex,
    takenOver: body.takenOver,
  })
  return json({
    reply: result.reply,
    source: result.source,
    ticket: ticketFiled,
    lang,
    advisor: result.advisor,
    hermesReady: hermesReady(envBag()),
    reconnecting: result.reconnecting === true,
    visitorId,
  })
}

export const config: Config = {
  method: ["POST", "OPTIONS"],
}
