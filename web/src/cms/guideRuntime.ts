import { completeChatCompletions, minimaxEnvFrom, type ChatCompletionsEnv } from "./chatCompletions"
import { buildGuideMessages, type GuideMessage } from "./guidePrompt"
import { localGuideAnswer } from "./knowledge"
import { extractTicket, stripTicketTags, type TicketDraft } from "./ticket"

export type GuideEnvBag = Record<string, string | undefined>

export type GuideResult = {
  reply: string
  source: "minimax" | "custom" | "local"
  ticket: TicketDraft | null
}

export async function resolveGuideReply(
  history: GuideMessage[],
  knowledge: string,
  env: GuideEnvBag,
  extraSystem?: string,
): Promise<GuideResult> {
  // Ticket markers are a model-only protocol; never accept them from users.
  const cleanedHistory = history.map((item) =>
    item.role === "user" ? { ...item, content: stripTicketTags(item.content) } : item,
  )
  const lastUser = [...cleanedHistory].reverse().find((item) => item.role === "user")
  const fallback = lastUser ? localGuideAnswer(lastUser.content, knowledge) : "请先问一个具体问题。"
  const messages = buildGuideMessages(cleanedHistory, knowledge, extraSystem)

  const minimax = minimaxEnvFrom(env)
  if (minimax) {
    try {
      const raw = await completeChatCompletions(minimax, messages)
      if (raw) {
        const { reply, ticket } = extractTicket(raw)
        if (reply) return { reply, source: "minimax", ticket }
      }
    } catch (error) {
      console.error("ash-guide minimax", error)
    }
  }

  const customBase = (env.ASH_AI_BASE_URL || "").replace(/\/$/, "")
  const customKey = (env.ASH_AI_API_KEY || "").trim()
  if (customBase && customKey && !minimax) {
    const custom: ChatCompletionsEnv = {
      apiKey: customKey,
      baseUrl: customBase,
      model: (env.ASH_AI_MODEL || "gpt-4o-mini").trim(),
    }
    try {
      const raw = await completeChatCompletions(custom, messages)
      if (raw) {
        const { reply, ticket } = extractTicket(raw)
        if (reply) return { reply, source: "custom", ticket }
      }
    } catch (error) {
      console.error("ash-guide custom", error)
    }
  }

  return { reply: fallback, source: "local", ticket: null }
}
