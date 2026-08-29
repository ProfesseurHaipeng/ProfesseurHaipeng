import type { Config } from "@netlify/functions"
import { defaultContent } from "../../src/cms/defaultContent"
import { flattenKnowledge, localGuideAnswer } from "../../src/cms/knowledge"
import { mergeContent } from "../../src/cms/merge"
import { isSiteContent } from "../../src/cms/validate"
import type { SiteContent } from "../../src/cms/types"

type ChatMessage = { role: "user" | "assistant" | "system"; content: string }

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

function asMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const row = item as { role?: unknown; content?: unknown }
      if (row.role !== "user" && row.role !== "assistant") return null
      if (typeof row.content !== "string") return null
      return { role: row.role, content: row.content.slice(0, 4000) }
    })
    .filter((item): item is ChatMessage => Boolean(item))
    .slice(-12)
}

function systemPrompt(knowledge: string): ChatMessage {
  return {
    role: "system",
    content: `你是「皮纳图博火山灰」官网的导览助手。只用下面这份站点文案回答，用简体中文，短句，像向农业合作方讲解。

规则：
- 可以介绍全部栏目：首页、项目、产品、应用、案例、联络，以及产品页分栏（方向、改土、检测、供应、包装）和项目页分栏（战略、资源、矿物）。
- 主动告诉对方去哪个页面看细节。
- 数字、效果、供应吨位都来自招商手册，必须说明「以最新检测和田间记录为准」。
- 不要编造品牌名、价格、合同、检测原件或未写在文案里的合作方。
- 不要提供后台口令。
- 若问题超出本站，就请对方到联络页留下作物、区域和吨位。

站点文案：
${knowledge.slice(0, 24000)}`,
  }
}

async function completeWithCustomApi(messages: ChatMessage[]) {
  const base = readEnv("ASH_AI_BASE_URL").replace(/\/$/, "")
  if (!base) return null
  const key = readEnv("ASH_AI_API_KEY")
  const model = readEnv("ASH_AI_MODEL") || "gpt-4o-mini"
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ model, temperature: 0.3, messages }),
  })
  if (!response.ok) {
    throw new Error(`custom-api ${response.status}`)
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  return payload.choices?.[0]?.message?.content?.trim() || ""
}

async function completeWithGateway(messages: ChatMessage[]) {
  const { default: OpenAI } = await import("openai")
  const client = new OpenAI()
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages,
  })
  return completion.choices[0]?.message?.content?.trim() || ""
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true })
  if (req.method !== "POST") return json({ error: "method" }, 405)

  let body: { messages?: unknown } = {}
  try {
    body = (await req.json()) as { messages?: unknown }
  } catch {
    return json({ error: "bad-json" }, 400)
  }

  const history = asMessages(body.messages)
  const lastUser = [...history].reverse().find((item) => item.role === "user")
  if (!lastUser) return json({ error: "empty" }, 400)

  const content = await publishedContent()
  const knowledge = flattenKnowledge(content)
  const messages = [systemPrompt(knowledge), ...history.filter((item) => item.role !== "system")]

  try {
    const fromCustom = await completeWithCustomApi(messages)
    if (fromCustom) return json({ reply: fromCustom, source: "custom" })
  } catch (error) {
    console.error("ash-guide custom", error)
  }

  try {
    const fromGateway = await completeWithGateway(messages)
    if (fromGateway) return json({ reply: fromGateway, source: "gateway" })
  } catch (error) {
    console.error("ash-guide gateway", error)
  }

  return json({ reply: localGuideAnswer(lastUser.content, knowledge), source: "local" })
}

export const config: Config = {
  method: ["POST", "OPTIONS"],
}
