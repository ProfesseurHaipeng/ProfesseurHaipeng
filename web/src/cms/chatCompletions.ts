import type { GuideMessage } from "./guidePrompt"

export type ChatCompletionsEnv = {
  apiKey: string
  baseUrl: string
  model: string
  groupId?: string
}

export function minimaxEnvFrom(source: Record<string, string | undefined>): ChatCompletionsEnv | null {
  const apiKey = (source.MINIMAX_API_KEY || "").trim()
  if (!apiKey) return null
  const baseUrl = (source.MINIMAX_API_BASE || "https://api.minimax.io/v1").replace(/\/$/, "")
  const model = (source.MINIMAX_MODEL || "MiniMax-Text-01").trim()
  const groupId = (source.MINIMAX_GROUP_ID || "").trim() || undefined
  return { apiKey, baseUrl, model, groupId }
}

export async function completeChatCompletions(env: ChatCompletionsEnv, messages: GuideMessage[]) {
  const endpoint = new URL(`${env.baseUrl}/chat/completions`)
  if (env.groupId) endpoint.searchParams.set("GroupId", env.groupId)

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.apiKey}`,
    },
    body: JSON.stringify({
      model: env.model,
      temperature: 0.3,
      max_tokens: 1200,
      messages: messages.map((item) => ({ role: item.role, content: item.content })),
    }),
  })

  const payload = (await response.json()) as {
    error?: { message?: string }
    base_resp?: { status_code?: number; status_msg?: string }
    choices?: { message?: { content?: string | { text?: string }[] } }[]
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || `minimax ${response.status}`)
  }
  if (payload.base_resp && payload.base_resp.status_code && payload.base_resp.status_code !== 0) {
    throw new Error(payload.base_resp.status_msg || "minimax rejected")
  }

  const content = payload.choices?.[0]?.message?.content
  if (typeof content === "string") return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part.text || ""))
      .join("")
      .trim()
  }
  return ""
}
