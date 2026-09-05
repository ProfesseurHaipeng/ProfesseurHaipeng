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

export function signedGuideEnabled(source: Record<string, string | undefined>) {
  return Boolean(source.ADVISOR_CASE_ID_SECRET?.trim() || source.SIGNED_GUIDE_FALLBACK === "1")
}

export function hermesReady(source: Record<string, string | undefined>) {
  return Boolean(hermesEnvFrom(source) || signedGuideEnabled(source))
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

async function probeLiveHermes(hermes: ChatCompletionsEnv): Promise<boolean> {
  const headers = { Authorization: `Bearer ${hermes.apiKey}` }
  try {
    const models = await fetch(`${hermes.baseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(4000),
    })
    if (models.ok) return true
  } catch {
    /* /models is optional; some gateways only expose chat. */
  }
  try {
    const ping = await fetch(`${hermes.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        model: hermes.model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
    })
    return ping.ok
  } catch {
    return false
  }
}

/** Cheap then real ping of the locked signed-guide line. */
export async function probeSignedGuide(timeoutMs = 8_000): Promise<boolean> {
  try {
    const status = await fetch(SIGNED_GUIDE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(Math.min(5000, timeoutMs)),
      body: JSON.stringify({ hermes: "status" }),
    })
    if (status.ok) {
      const payload = (await status.json()) as { ready?: boolean }
      if (payload.ready === true) return true
    }
  } catch {
    /* older locked deploys may not answer status */
  }
  try {
    const signed = await resolveHermesViaSignedGuide(
      [{ role: "user", content: "请用一句话确认你在线。" }],
      "zh",
      { timeoutMs },
    )
    return Boolean(signed?.reply)
  } catch {
    return false
  }
}

/** Live and signed probes in parallel so a slow main line cannot mark the desk disconnected. */
export async function probeHermes(source: Record<string, string | undefined>): Promise<HermesHealth> {
  const hermes = hermesEnvFrom(source)
  const checkedAt = new Date().toISOString()
  const signedOn = signedGuideEnabled(source)
  if (!hermes && !signedOn) {
    return { status: "disconnected", checkedAt, detail: "未配置高级顾问网关" }
  }
  const [live, signed] = await Promise.all([
    hermes ? probeLiveHermes(hermes) : Promise.resolve(false),
    signedOn ? probeSignedGuide(4_000) : Promise.resolve(false),
  ])
  if (live) return { status: "connected", checkedAt, model: hermes?.model, detail: "主线路已接通" }
  if (signed) return { status: "connected", checkedAt, model: hermes?.model, detail: "备用线路已接通" }
  return {
    status: "disconnected",
    checkedAt,
    model: hermes?.model,
    detail: hermes ? "主线路与备用线路都不可达" : "备用线路不可达",
  }
}

/** Keep a good health row when a later probe is a one-off miss. */
export function rememberHermesHealth(prev: HermesHealth | null | undefined, next: HermesHealth): HermesHealth {
  if (next.status === "connected") return next
  if (prev?.status === "connected") {
    return {
      ...prev,
      checkedAt: next.checkedAt,
      detail: `主线路这一下没探上（${next.detail || "超时"}）。备用线路仍按已接通处理。`,
    }
  }
  return next
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

function signedGuideMessages(history: GuideMessage[], extraSystem?: string) {
  const prepared = withSyncedMemory(history, extraSystem)
  const head = extraSystem?.trim() ? prepared.slice(0, 2) : []
  return [...head, ...prepared.slice(head.length).slice(-6)]
}

function lastTopicUser(history: GuideMessage[], lang: "zh" | "en") {
  const users = history.filter((item) => item.role === "user" && item.content.trim())
  const last = users.at(-1)?.content.trim() || ""
  if (users.length > 1 && /转(高级)?顾问|转接|handoff|senior advisor/i.test(last)) {
    return users.at(-2)!.content.trim()
  }
  return last || inScopeTakeover(lang)
}

function publicKnownFacts(extraSystem?: string) {
  return (extraSystem || "")
    .split(/\n+/)
    .filter((line) => /长期记忆|称呼|机构|工厂|地区|线索|下一步|进度|跟进|FOB|报价|作物|吨/.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300)
}

async function resolveHermesViaSignedGuide(
  history: GuideMessage[],
  lang: "zh" | "en",
  options?: { escalate?: boolean; visitorId?: string; timeoutMs?: number },
  extraSystem?: string,
) {
  const lastUser = lastTopicUser(history, lang)
  const known = publicKnownFacts(extraSystem)
  const alreadyCompact = history.length <= 2 && /皮纳图博火山灰/.test(lastUser)
  const messages =
    options?.escalate === true && !alreadyCompact
      ? [
          {
            role: "user" as const,
            content: `皮纳图博火山灰项目。${known ? `已知：${known}。` : ""}客户刚说：${lastUser.slice(0, 400)}。请接手后用短段中文接着谈作物、吨位或供应。`,
          },
        ]
      : signedGuideMessages(hermesHistoryForGateway(history, lang, options?.escalate), extraSystem)
  const response = await fetch(SIGNED_GUIDE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(options?.timeoutMs ?? 14_000),
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
  if (isAdvisorOutageJoke(payload.reply) || /请联络项目人员|请联系项目人员|还在从内网接到/.test(payload.reply)) return null
  const { reply, ticket } = extractTicket(payload.reply)
  if (!reply) return null
  return { reply, source: "hermes" as const, ticket, reconnecting: false }
}

export async function resolveCoachViaSignedGuide(user: string, extraSystem?: string) {
  const instruction = user.trim().slice(0, 800) || "先确认这条线还通，接着按作物和吨位跟进。"
  const known = extraSystem?.replace(/\s+/g, " ").trim().slice(0, 400)
  const messages: GuideMessage[] = [
    {
      role: "user",
      content: `皮纳图博火山灰项目。${known ? `已知：${known}。` : ""}同事要求：${instruction}。请用短段中文说明你怎么跟进。`,
    },
  ]
  const first = await resolveHermesViaSignedGuide(messages, "zh", { escalate: true, timeoutMs: 16_000 })
  if (first) return first
  return resolveHermesViaSignedGuide(
    [
      {
        role: "user",
        content: `皮纳图博火山灰，水稻，吨位。同事说${instruction}。请回复你会怎么跟。`,
      },
    ],
    "zh",
    { escalate: true, timeoutMs: 12_000 },
  )
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
  const fallbackOn = signedGuideEnabled(env)
  const unconfigured = options?.escalate ? hermesHandoffGreeting(lang) : hermesUnavailableReply(lang)
  if (!hermes) {
    if (fallbackOn) {
      try {
        const signed = await resolveHermesViaSignedGuide(
          history,
          lang,
          { ...options, timeoutMs: options?.timeoutMs ?? 20_000 },
          extraSystem,
        )
        if (signed) return signed
      } catch (error) {
        console.error("ash-guide senior advisor signed-guide", error)
      }
    }
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
        timeoutMs: options?.timeoutMs ?? (fallbackOn ? 10_000 : 8_000),
        conversationId: options?.conversationId || env.ADVISOR_CASE_ID_SECRET?.trim(),
        conversationIds: fallbackOn
          ? [options?.conversationId || env.ADVISOR_CASE_ID_SECRET?.trim()].filter((item): item is string => Boolean(item))
          : [
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
  if (fallbackOn) {
    try {
      const signed = await resolveHermesViaSignedGuide(history, lang, options, extraSystem)
      if (signed) return signed
    } catch (error) {
      console.error("ash-guide senior advisor signed-guide", error)
    }
  }
  return { reply: hermesReconnectingReply(lang), source: "local" as const, ticket: null, reconnecting: true }
}
