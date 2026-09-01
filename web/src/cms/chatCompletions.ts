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

const MINIMAX_HOSTS = ["https://api.minimax.io/v1", "https://api.minimaxi.com/v1"] as const

export function stripModelThink(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
}

function alternateMinimaxBases(preferred: string) {
  const ordered = [preferred.replace(/\/$/, ""), ...MINIMAX_HOSTS]
  return [...new Set(ordered)]
}

async function completeOnce(env: ChatCompletionsEnv, messages: GuideMessage[]) {
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
    error?: { message?: string; type?: string }
    base_resp?: { status_code?: number; status_msg?: string }
    choices?: { message?: { content?: string | { text?: string }[] } }[]
  }

  if (!response.ok) {
    const error = new Error(payload.error?.message || `minimax ${response.status}`)
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }
  if (payload.base_resp && payload.base_resp.status_code && payload.base_resp.status_code !== 0) {
    throw new Error(payload.base_resp.status_msg || "minimax rejected")
  }

  const content = payload.choices?.[0]?.message?.content
  if (typeof content === "string") return stripModelThink(content)
  if (Array.isArray(content)) {
    return stripModelThink(
      content.map((part) => (typeof part === "string" ? part : part.text || "")).join(""),
    )
  }
  return ""
}

function isHostAuthError(error: unknown) {
  if (!(error instanceof Error)) return false
  const status = (error as Error & { status?: number }).status
  if (status === 401 || status === 403) return true
  return /invalid api key|authorized_error|401/i.test(error.message)
}

export async function completeChatCompletions(env: ChatCompletionsEnv, messages: GuideMessage[]) {
  const bases = alternateMinimaxBases(env.baseUrl)
  let lastError: unknown
  for (const baseUrl of bases) {
    try {
      return await completeOnce({ ...env, baseUrl }, messages)
    } catch (error) {
      lastError = error
      if (!isHostAuthError(error) || bases.indexOf(baseUrl) === bases.length - 1) throw error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("minimax failed")
}
