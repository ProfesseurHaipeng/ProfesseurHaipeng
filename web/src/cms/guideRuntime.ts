import { completeChatCompletions, minimaxEnvFrom, type ChatCompletionsEnv } from "./chatCompletions"
import { buildGuideMessages, type GuideMessage } from "./guidePrompt"
import { localGuideAnswer } from "./knowledge"

export type GuideEnvBag = Record<string, string | undefined>

export async function resolveGuideReply(
  history: GuideMessage[],
  knowledge: string,
  env: GuideEnvBag,
): Promise<{ reply: string; source: "minimax" | "custom" | "local" }> {
  const lastUser = [...history].reverse().find((item) => item.role === "user")
  const fallback = lastUser ? localGuideAnswer(lastUser.content, knowledge) : "请先问一个具体问题。"
  const messages = buildGuideMessages(history, knowledge)

  const minimax = minimaxEnvFrom(env)
  if (minimax) {
    try {
      const reply = await completeChatCompletions(minimax, messages)
      if (reply) return { reply, source: "minimax" }
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
      const reply = await completeChatCompletions(custom, messages)
      if (reply) return { reply, source: "custom" }
    } catch (error) {
      console.error("ash-guide custom", error)
    }
  }

  return { reply: fallback, source: "local" }
}
