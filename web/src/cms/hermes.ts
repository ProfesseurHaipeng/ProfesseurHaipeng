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
const HERMES_GATEWAY_BRIEF = `你是菲律宾皮纳图博火山灰农业综合产业项目的高级顾问 Karmenai。从产品顾问小林手里接手后，用短段中文接着谈作物、吨位、检测和供应。客户主动留下手机或微信时用隐藏 <ticket> 建档，邮箱必须先征得同意。不要提内部系统名，不要说自己断线或在冲凉。`

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
    [HERMES_GATEWAY_BRIEF, knowledge.trim().slice(0, 1200), extraSystem?.trim().slice(0, 400) || ""]
      .filter(Boolean)
      .join("\n\n"),
    denied,
  ).slice(0, GATEWAY_MESSAGE_LIMIT)
  return [{ role: "system" as const, content: system }, ...cleaned]
}

export function hermesUnavailableReply(lang: "zh" | "en") {
  return lang === "en"
    ? "Karmenai is not on this line yet. Please keep talking with the product advisor, or try the senior advisor again in a moment."
    : "高级顾问 Karmenai 这条线还没接通。请先继续问产品顾问，或稍后再转一次。"
}

export function hermesReconnectingReply(lang: "zh" | "en") {
  return lang === "en"
    ? "The senior advisor line dropped for a moment. I'm reconnecting now — send another message shortly and I'll continue as Karmenai."
    : "高级顾问线路这一下没接上，正在重新连接。请稍后再发一条，接通后我是 Karmenai，会接着跟您谈。"
}

export function isAdvisorOutageJoke(text: string) {
  return /冲凉|洗澡|无法连接成功|还在从内网接到|正在冲凉/.test(text)
}

export function hermesHandoffGreeting(lang: "zh" | "en") {
  return lang === "en"
    ? "Hello — I'm Karmenai, the senior advisor. I'll take it from here."
    : "您好，我是高级顾问 Karmenai，后面由我来跟您谈。"
}

export function hermesHandoffNotice(lang: "zh" | "en") {
  return lang === "en" ? "You’ve been transferred to the senior advisor." : "已转接高级顾问为您服务"
}

export function hermesHandoffHint(lang: "zh" | "en") {
  return lang === "en"
    ? "The customer asked to speak with the senior advisor. You are Karmenai taking over this live chat. Acknowledge the handoff in one short line as Karmenai, then continue from the last topic. Do not restart a full introduction. Only call yourself Karmenai."
    : "客户要求转接高级顾问。你现在是 Karmenai，接手这场对话。先用一句短话确认已接上，然后接着对方刚才的话题往下谈，不要重新自我介绍一整段。对客户只称 Karmenai。"
}

export async function resolveHermesReply(
  history: GuideMessage[],
  knowledge: string,
  env: Record<string, string | undefined>,
  extraSystem: string | undefined,
  lang: "zh" | "en",
  options?: { escalate?: boolean; timeoutMs?: number; conversationId?: string; identityHeaders?: Record<string, string> },
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
        timeoutMs: options?.timeoutMs ?? 12_000,
        conversationId: options?.conversationId,
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
  return { reply: hermesReconnectingReply(lang), source: "local" as const, ticket: null, reconnecting: true }
}
