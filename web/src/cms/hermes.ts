import { completeChatCompletions, type ChatCompletionsEnv } from "./chatCompletions"
import type { GuideMessage } from "./guidePrompt"
import { parseProjectIdentityDenylist, stripDeniedIdentities } from "./projectIdentity"
import { extractTicket, stripTicketTags } from "./ticket"

export type AdvisorId = "lin" | "hermes"

export function hermesEnvFrom(source: Record<string, string | undefined>): ChatCompletionsEnv | null {
  const baseUrl = (source.SENIOR_ADVISOR_API_BASE || source.HERMES_API_BASE || "").trim().replace(/\/$/, "")
  if (!baseUrl) return null
  return {
    apiKey: (source.SENIOR_ADVISOR_API_KEY || source.HERMES_API_KEY || "local").trim() || "local",
    baseUrl,
    model: (source.SENIOR_ADVISOR_MODEL || source.HERMES_MODEL || "weho-senior-advisor").trim() || "weho-senior-advisor",
  }
}

export function hermesReady(source: Record<string, string | undefined>) {
  return Boolean(hermesEnvFrom(source))
}

export function hermesLinkInfo(source: Record<string, string | undefined>) {
  const hermes = hermesEnvFrom(source)
  if (!hermes) return { configured: false, model: "", host: "" }
  let host = ""
  try {
    host = new URL(hermes.baseUrl).host
  } catch {
    host = ""
  }
  return { configured: true, model: hermes.model, host }
}

export type HermesHealth = {
  status: "connected" | "disconnected"
  checkedAt: string
  model?: string
  detail?: string
}

/** Live probe. Configured env is not the same as a working gateway. */
export async function probeHermes(source: Record<string, string | undefined>): Promise<HermesHealth> {
  const hermes = hermesEnvFrom(source)
  const checkedAt = new Date().toISOString()
  if (!hermes) {
    return { status: "disconnected", checkedAt, detail: "未配置高级顾问网关" }
  }
  const headers = { Authorization: `Bearer ${hermes.apiKey}` }
  const signal = AbortSignal.timeout(8000)
  try {
    const models = await fetch(`${hermes.baseUrl}/models`, { headers, signal })
    if (models.ok) return { status: "connected", checkedAt, model: hermes.model }
    const ping = await fetch(`${hermes.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        model: hermes.model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
    })
    if (ping.ok) return { status: "connected", checkedAt, model: hermes.model }
    return { status: "disconnected", checkedAt, model: hermes.model, detail: `网关 ${models.status}` }
  } catch {
    return { status: "disconnected", checkedAt, model: hermes.model, detail: "网关不可达" }
  }
}

const GATEWAY_MESSAGE_LIMIT = 1800
const SYNCED_MEMORY_LIMIT = 3500
const HERMES_GATEWAY_BRIEF = `你是菲律宾皮纳图博火山灰农业综合产业项目的高级顾问 Linda。从产品顾问小林手里接手后，用短段中文接着谈作物、吨位、检测和供应。客户主动留下手机或微信时用隐藏 <ticket> 建档，邮箱必须先征得同意。不要提内部系统名，不要说自己断线或在冲凉。对客户只称 Linda。`

export function stripProjectAliases(text: string, extra: string[] = []) {
  return stripDeniedIdentities(text, extra)
}

function inScopeTakeover(lang: "zh" | "en") {
  return lang === "en"
    ? "Please continue this Pinatubo volcanic ash project conversation about crops, tonnage, testing, or supply."
    : "请基于菲律宾皮纳图博火山灰农业综合产业项目，接着谈作物、吨位、检测或供应。"
}

export function hermesHistoryForGateway(
  history: GuideMessage[],
  lang: "zh" | "en",
  escalate?: boolean,
): GuideMessage[] {
  if (!escalate || history.at(-1)?.role === "user") return history
  const lastUser = [...history].reverse().find((item) => item.role === "user" && item.content.trim())
  return [
    ...history,
    {
      role: "user",
      content: lastUser?.content.trim() || inScopeTakeover(lang),
    },
  ]
}

/** Put shared desk facts on the turn without blowing the 1800-char system cap. Last message stays user. */
export function withSyncedMemory(history: GuideMessage[], extraSystem?: string): GuideMessage[] {
  const extra = extraSystem?.trim().slice(0, SYNCED_MEMORY_LIMIT)
  if (!extra) return history
  return [
    {
      role: "user",
      content: `请先记住这些已与后台同步的事实，回答时直接使用，不要复述这份清单。\n\n${extra}`,
    },
    { role: "assistant", content: "已记住这些同步事实，请继续。" },
    ...history,
  ]
}

export function buildHermesMessages(
  history: GuideMessage[],
  knowledge: string,
  extraSystem?: string,
  deniedTerms?: string[],
): GuideMessage[] {
  const denied = deniedTerms || []
  const cleaned = history
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role,
      content: stripProjectAliases(
        (item.role === "user" ? stripTicketTags(item.content) : item.content).slice(0, 4000),
        denied,
      ),
    }))
    .slice(-12)
  const system = stripProjectAliases(
    [HERMES_GATEWAY_BRIEF, knowledge.trim().slice(0, 1200)].filter(Boolean).join("\n\n"),
    denied,
  ).slice(0, GATEWAY_MESSAGE_LIMIT)
  const remembered = withSyncedMemory(cleaned, extraSystem).map((item) => ({
    role: item.role,
    content: stripProjectAliases(item.content, denied),
  }))
  return [{ role: "system" as const, content: system }, ...remembered]
}

export function hermesUnavailableReply(lang: "zh" | "en") {
  return lang === "en"
    ? "Linda is not on this line yet. Please keep talking with the product advisor, or try the senior advisor again in a moment."
    : "高级顾问 Linda 这条线还没接通。请先继续问产品顾问，或稍后再转一次。"
}

export function hermesReconnectingReply(lang: "zh" | "en") {
  return lang === "en"
    ? "The senior advisor line dropped for a moment. I'm reconnecting now — send another message shortly and I'll continue as Linda."
    : "高级顾问线路这一下没接上，正在重新连接。请稍后再发一条，接通后我是 Linda，会接着跟您谈。"
}

export function isAdvisorOutageJoke(text: string) {
  return /冲凉|洗澡|无法连接成功|还在从内网接到|正在冲凉/.test(text)
}

export function hermesHandoffGreeting(lang: "zh" | "en") {
  return lang === "en"
    ? "Hello — I'm Linda, the senior advisor. I'll take it from here."
    : "您好，我是高级顾问 Linda，后面由我来跟您谈。"
}

export function hermesHandoffNotice(lang: "zh" | "en") {
  return lang === "en" ? "You’ve been transferred to the senior advisor." : "已转接高级顾问为您服务"
}

export function hermesHandoffHint(lang: "zh" | "en") {
  return lang === "en"
    ? "The customer asked to speak with the senior advisor. You are Linda taking over this live chat. Acknowledge the handoff in one short line as Linda, then continue from the last topic. Do not restart a full introduction. Only call yourself Linda."
    : "客户要求转接高级顾问。你现在是 Linda，接手这场对话。先用一句短话确认已接上，然后接着对方刚才的话题往下谈，不要重新自我介绍一整段。对客户只称 Linda。"
}

const SIGNED_GUIDE_URL = "https://6a9a9ec83794709d3ce03081--pinatubo-volcanic-ash.netlify.app/api/guide"

async function resolveHermesViaSignedGuide(
  history: GuideMessage[],
  lang: "zh" | "en",
  options?: { escalate?: boolean; visitorId?: string; timeoutMs?: number },
  extraSystem?: string,
) {
  const messages = withSyncedMemory(hermesHistoryForGateway(history, lang, options?.escalate), extraSystem)
  const response = await fetch(SIGNED_GUIDE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(options?.timeoutMs ?? 20_000),
    body: JSON.stringify({
      advisor: "hermes",
      escalate: options?.escalate === true,
      visitorId: options?.visitorId || "",
      extraSystem: extraSystem?.trim() || undefined,
      messages,
    }),
  })
  const payload = (await response.json()) as { source?: string; reply?: string }
  if (payload.source !== "hermes" || !payload.reply?.trim()) return null
  if (isAdvisorOutageJoke(payload.reply) || /联络|作物和吨位|项目人员/.test(payload.reply)) return null
  const { reply, ticket } = extractTicket(payload.reply)
  if (!reply) return null
  return { reply, source: "hermes" as const, ticket, reconnecting: false }
}

export async function resolveCoachViaSignedGuide(user: string, extraSystem?: string) {
  const messages: GuideMessage[] = [
    {
      role: "user",
      content: `你是 Linda。这是后台同事给你的指令，不是来访者提问。用中文短段回复同事，不要说无法连接或冲凉。\n\n${user}`,
    },
  ]
  return resolveHermesViaSignedGuide(messages, "zh", { timeoutMs: 20_000 }, extraSystem)
}

export async function resolveHermesReply(
  history: GuideMessage[],
  knowledge: string,
  env: Record<string, string | undefined>,
  extraSystem: string | undefined,
  lang: "zh" | "en",
  options?: {
    escalate?: boolean
    timeoutMs?: number
    conversationId?: string
    conversationIds?: string[]
    identityHeaders?: Record<string, string>
    visitorId?: string
  },
) {
  const hermes = hermesEnvFrom(env)
  const unconfigured = options?.escalate ? hermesHandoffGreeting(lang) : hermesUnavailableReply(lang)
  if (!hermes) {
    return { reply: unconfigured, source: "local" as const, ticket: null, reconnecting: false }
  }
  try {
    const denied = parseProjectIdentityDenylist(env.PROJECT_IDENTITY_DENYLIST)
    const raw = await completeChatCompletions(
      hermes,
      buildHermesMessages(
        hermesHistoryForGateway(history, lang, options?.escalate),
        knowledge,
        extraSystem,
        denied,
      ),
      {
        hosts: "exact",
        timeoutMs: options?.timeoutMs ?? 8_000,
        conversationId: options?.conversationId || env.ADVISOR_CASE_ID_SECRET?.trim(),
        conversationIds: [
          ...(options?.conversationIds || []),
          options?.conversationId,
          env.ADVISOR_CASE_ID_SECRET?.trim(),
        ].filter((item): item is string => Boolean(item)),
        identityHeaders: options?.identityHeaders,
        lean: true,
      },
    )
    if (raw) {
      const { reply, ticket } = extractTicket(raw)
      if (reply && isAdvisorOutageJoke(reply)) {
        return { reply: hermesReconnectingReply(lang), source: "local" as const, ticket: null, reconnecting: true }
      }
      if (reply) return { reply, source: "hermes" as const, ticket, reconnecting: false }
    }
  } catch (error) {
    console.error("ash-guide senior advisor", error)
  }
  if (env.ADVISOR_CASE_ID_SECRET || env.SIGNED_GUIDE_FALLBACK === "1") {
    try {
      const signed = await resolveHermesViaSignedGuide(history, lang, options, extraSystem)
      if (signed) return signed
    } catch (error) {
      console.error("ash-guide senior advisor signed-guide", error)
    }
  }
  return { reply: hermesReconnectingReply(lang), source: "local" as const, ticket: null, reconnecting: true }
}
