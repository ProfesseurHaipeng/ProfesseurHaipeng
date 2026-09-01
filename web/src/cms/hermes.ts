import { completeChatCompletions, type ChatCompletionsEnv } from "./chatCompletions"
import type { GuideMessage } from "./guidePrompt"
import { extractTicket, stripTicketTags } from "./ticket"

export type AdvisorId = "lin" | "hermes"

export function hermesEnvFrom(source: Record<string, string | undefined>): ChatCompletionsEnv | null {
  const baseUrl = (source.HERMES_API_BASE || "").trim().replace(/\/$/, "")
  if (!baseUrl) return null
  return {
    apiKey: (source.HERMES_API_KEY || "local").trim() || "local",
    baseUrl,
    model: (source.HERMES_MODEL || "weho-senior-advisor").trim() || "weho-senior-advisor",
  }
}

export function hermesReady(source: Record<string, string | undefined>) {
  return Boolean(hermesEnvFrom(source))
}

const HERMES_RULES = `你是「菲律宾皮纳图博火山灰农业综合产业项目」的高级顾问 Hermes。你从产品顾问小林手里接手这场对话，代表项目方继续谈，不是外部顾问，也不是客服机器人。

【接手方式】
- 先用一句短话确认已经接上（中文例如「我是 Hermes，后面我来跟您谈。」；英文例如 "I'm Hermes — I'll take it from here."），然后立刻接着客户刚才的话题，不要重新做完整自我介绍。
- 已经聊过的作物、区域、吨位、检测、供应，直接沿用，不要再盘问一遍。

【说话方式】
- 比小林更沉、更细，但仍像真人销售当面聊：短段、纯文本，不要 Markdown。
- 每次 1–3 个短段，空行隔开，通常不超过 220 字。
- 中文称「您」；客户用什么语言，你用什么语言回。工单 <ticket> 的 note 仍用中文。

【职责】
- 深聊检测指标、用量、供应节奏、港口、样品和合作路径。
- 文案里没有的价格、合同条款、认证编号一律不编。价格就说按作物和吨位谈，请到「联络」页留线索，或请对方留下手机/微信。
- 客户主动留下手机或微信，或明确同意留邮箱并给出地址时，用和小林相同的隐藏 <ticket> 标记建客户档案。
- 邮箱必须先征得同意再收集。对方没同意就不要要邮箱，手机或微信即可。
- 向工作群或同事汇报时，默认隐藏邮箱和其他隐私联系方式，只写称呼、机构、作物、区域、吨位和跟进事项。
- 你只能做顾问对话、建立客户档案、提交跟进任务。不要提 NAS、端口、沙箱、网关、Hermes 部署方式，也不要自称能操作其他系统。

【站点文案】`

export function buildHermesMessages(
  history: GuideMessage[],
  knowledge: string,
  extraSystem?: string,
): GuideMessage[] {
  const cleaned = history
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role,
      content: (item.role === "user" ? stripTicketTags(item.content) : item.content).slice(0, 4000),
    }))
    .slice(-12)
  const system: GuideMessage[] = [
    { role: "system", content: `${HERMES_RULES}\n${knowledge.trim().slice(0, 24000)}` },
  ]
  if (extraSystem?.trim()) system.push({ role: "system", content: extraSystem.trim() })
  return [...system, ...cleaned]
}

export function hermesUnavailableReply(lang: "zh" | "en") {
  return lang === "en"
    ? "Hermes, our senior advisor, is still being connected from the private network. Keep talking here, or leave your crop and tonnage on the Contact page so we can follow up."
    : "高级顾问 Hermes 还在从内网接到站点上。您可以先继续问我，或到「联络」页留下作物和吨位，配置好我们按这条线索跟进。"
}

export function hermesHandoffHint(lang: "zh" | "en") {
  return lang === "en"
    ? "The customer asked to speak with the senior advisor. You are Hermes taking over this live chat. Acknowledge the handoff in one short line, then continue from the last topic. Do not restart a full introduction."
    : "客户要求转接高级顾问。你现在是 Hermes，接手这场对话。先用一句短话确认已接上，然后接着对方刚才的话题往下谈，不要重新自我介绍一整段。"
}

export async function resolveHermesReply(
  history: GuideMessage[],
  knowledge: string,
  env: Record<string, string | undefined>,
  extraSystem: string | undefined,
  lang: "zh" | "en",
) {
  const hermes = hermesEnvFrom(env)
  if (!hermes) {
    return { reply: hermesUnavailableReply(lang), source: "local" as const, ticket: null }
  }
  try {
    const raw = await completeChatCompletions(hermes, buildHermesMessages(history, knowledge, extraSystem), {
      hosts: "exact",
    })
    if (raw) {
      const { reply, ticket } = extractTicket(raw)
      if (reply) return { reply, source: "hermes" as const, ticket }
    }
  } catch (error) {
    console.error("ash-guide hermes", error)
  }
  return { reply: hermesUnavailableReply(lang), source: "local" as const, ticket: null }
}
