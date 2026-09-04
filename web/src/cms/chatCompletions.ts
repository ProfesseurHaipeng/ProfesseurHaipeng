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

/** Chat bubbles are plain text; drop Markdown markers the model sneaks in. */
export function stripMarkdownNoise(text: string) {
  return text
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*/g, "")
    .replace(/[ \t]+$/gm, "")
    .trim()
}

const SYCOPHANCY_OPENERS =
  /^(?:(?:that(?:'|’)s )?(?:a )?great question|good question|certainly|absolutely|sure thing|sure|i(?:'|’)d be happy to(?: help)?|thanks for reaching out|好问题|您说得对|问得好)(?=[!！.。，,\s]|$)[!！.。，,]?\s*/i

/** Drop chat-bot openers the model sneaks in despite the prompt ban. */
export function stripSycophancy(text: string) {
  return text
    .split("\n")
    .map((line) => {
      const stripped = line.replace(SYCOPHANCY_OPENERS, "")
      if (stripped === line || !stripped.trim()) return stripped === line ? line : ""
      return stripped.charAt(0).toUpperCase() + stripped.slice(1)
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function cleanReplyText(text: string) {
  return stripSycophancy(stripMarkdownNoise(stripModelThink(text)))
}

function alternateMinimaxBases(preferred: string) {
  const ordered = [preferred.replace(/\/$/, ""), ...MINIMAX_HOSTS]
  return [...new Set(ordered)]
}

function withImages(
  messages: GuideMessage[],
  images?: { mime: string; data: string }[],
) {
  if (!images?.length) return messages.map((item) => ({ role: item.role, content: item.content }))
  const lastUser = [...messages].reverse().find((item) => item.role === "user")
  return messages.map((item) => {
    if (item !== lastUser) return { role: item.role, content: item.content }
    return {
      role: item.role,
      content: [
        { type: "text" as const, text: item.content },
        ...images.map((image) => ({
          type: "image_url" as const,
          image_url: { url: `data:${image.mime};base64,${image.data}` },
        })),
      ],
    }
  })
}

type CompletionExtras = {
  headers?: Record<string, string>
  body?: Record<string, unknown>
}

async function completeOnce(
  env: ChatCompletionsEnv,
  messages: GuideMessage[],
  images?: { mime: string; data: string }[],
  timeoutMs = 20_000,
  extras?: CompletionExtras,
) {
  const endpoint = new URL(`${env.baseUrl}/chat/completions`)
  if (env.groupId) endpoint.searchParams.set("GroupId", env.groupId)

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.apiKey}`,
      ...extras?.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: env.model,
      temperature: 0.3,
      max_tokens: 1200,
      messages: withImages(messages, images),
      ...extras?.body,
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
  if (typeof content === "string") return cleanReplyText(content)
  if (Array.isArray(content)) {
    return cleanReplyText(
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

function isConversationIdentityError(error: unknown) {
  if (!(error instanceof Error)) return false
  return /isolated conversation identity|conversation identity is required|conversation id required/i.test(error.message)
}

type IdentityShape = {
  name: string
  extras: (id: string) => CompletionExtras
}

const IDENTITY_SHAPES: IdentityShape[] = [
  {
    name: "user",
    extras: (id) => ({
      body: { user: id },
      headers: { "X-Conversation-Id": id },
    }),
  },
  {
    name: "conversation_id",
    extras: (id) => ({ body: { conversation_id: id } }),
  },
  {
    name: "conversation_identity",
    extras: (id) => ({ body: { conversation_identity: id } }),
  },
  {
    name: "isolated_header",
    extras: (id) => ({ headers: { "X-Isolated-Conversation-Identity": id } }),
  },
]

let workingIdentityShape: string | null = null

export async function completeChatCompletions(
  env: ChatCompletionsEnv,
  messages: GuideMessage[],
  options?: {
    hosts?: "minimax-alt" | "exact"
    images?: { mime: string; data: string }[]
    timeoutMs?: number
    conversationId?: string
  },
) {
  const bases = options?.hosts === "exact" ? [env.baseUrl.replace(/\/$/, "")] : alternateMinimaxBases(env.baseUrl)
  const shapes = options?.conversationId
    ? workingIdentityShape
      ? IDENTITY_SHAPES.filter((item) => item.name === workingIdentityShape).concat(
          IDENTITY_SHAPES.filter((item) => item.name !== workingIdentityShape),
        )
      : IDENTITY_SHAPES
    : [{ name: "none", extras: () => ({}) }]
  let lastError: unknown
  for (const baseUrl of bases) {
    for (const shape of shapes) {
      try {
        const reply = await completeOnce(
          { ...env, baseUrl },
          messages,
          options?.hosts === "exact" ? options.images : undefined,
          options?.timeoutMs,
          options?.conversationId ? shape.extras(options.conversationId) : undefined,
        )
        if (options?.conversationId && shape.name !== "none") workingIdentityShape = shape.name
        return reply
      } catch (error) {
        lastError = error
        if (options?.conversationId && isConversationIdentityError(error)) continue
        if (options?.hosts === "exact" || !isHostAuthError(error) || bases.indexOf(baseUrl) === bases.length - 1) {
          throw error
        }
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("minimax failed")
}
