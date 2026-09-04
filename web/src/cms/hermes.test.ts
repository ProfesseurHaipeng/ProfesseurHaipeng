import { describe, expect, it } from "vitest"
import { defaultContent } from "./defaultContent"
import { flattenKnowledge } from "./knowledge"
import {
  buildHermesMessages,
  hermesEnvFrom,
  hermesHandoffHint,
  hermesLinkInfo,
  hermesReady,
  hermesHandoffGreeting,
  hermesHistoryForGateway,
  hermesReconnectingReply,
  hermesUnavailableReply,
  isAdvisorOutageJoke,
  probeHermes,
  resolveCoachViaSignedGuide,
  resolveHermesReply,
  signedGuideEnabled,
  withSyncedMemory,
} from "./hermes"

describe("hermes env", () => {
  it("stays off until a public API base is set", () => {
    expect(hermesEnvFrom({})).toBeNull()
    expect(hermesReady({ HERMES_API_KEY: "local", HERMES_MODEL: "hermes" })).toBe(false)
  })

  it("accepts an OpenAI-compatible base and defaults the key and model", () => {
    const env = hermesEnvFrom({ HERMES_API_BASE: "https://hermes.example.com/v1/" })
    expect(env?.baseUrl).toBe("https://hermes.example.com/v1")
    expect(env?.apiKey).toBe("local")
    expect(env?.model).toBe("weho-senior-advisor")
    expect(hermesReady({ HERMES_API_BASE: "https://hermes.example.com/v1" })).toBe(true)
    expect(hermesLinkInfo({ HERMES_API_BASE: "https://hermes.example.com/v1" })).toMatchObject({
      configured: true,
      host: "hermes.example.com",
      model: "weho-senior-advisor",
    })
    const senior = hermesEnvFrom({
      HERMES_API_BASE: "https://hermes.example.com/v1",
      HERMES_API_KEY: "old",
      SENIOR_ADVISOR_API_BASE: "https://advisor.example.com/v1",
      SENIOR_ADVISOR_API_KEY: "senior",
      SENIOR_ADVISOR_MODEL: "project-senior-advisor",
    })
    expect(senior).toMatchObject({
      baseUrl: "https://advisor.example.com/v1",
      apiKey: "senior",
      model: "project-senior-advisor",
    })
  })

  it("treats a missing gateway as disconnected", async () => {
    const health = await probeHermes({})
    expect(health.status).toBe("disconnected")
    expect(health.detail).toContain("高级顾问网关")
    expect(signedGuideEnabled({})).toBe(false)
  })

  it("treats the signed backup line as ready", () => {
    expect(hermesReady({ SIGNED_GUIDE_FALLBACK: "1" })).toBe(true)
    expect(signedGuideEnabled({ ADVISOR_CASE_ID_SECRET: "secret" })).toBe(true)
  })

  it("stays connected when only chat completions work", async () => {
    const original = globalThis.fetch
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.endsWith("/models")) return new Response("missing", { status: 404 })
      if (url.endsWith("/chat/completions")) return new Response("{}", { status: 200 })
      return new Response("no", { status: 500 })
    }
    try {
      const health = await probeHermes({ HERMES_API_BASE: "https://advisor.example.com/v1" })
      expect(health.status).toBe("connected")
      expect(health.detail).toContain("主线路")
    } finally {
      globalThis.fetch = original
    }
  })

  it("marks health connected when the signed backup answers", async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({ ready: true }), { status: 200 })
    try {
      const health = await probeHermes({ SIGNED_GUIDE_FALLBACK: "1" })
      expect(health.status).toBe("connected")
      expect(health.detail).toContain("备用线路")
    } finally {
      globalThis.fetch = original
    }
  })
})

describe("hermes prompt", () => {
  it("speaks as senior advisor Linda taking over from 小林", () => {
    const messages = buildHermesMessages(
      [
        { role: "assistant", content: "您好，我是小林。" },
        { role: "user", content: "水稻怎么用？" },
      ],
      flattenKnowledge(defaultContent),
    )
    expect(messages[0]?.role).toBe("system")
    expect(messages[0]?.content).toContain("Linda")
    expect(messages[0]?.content).not.toMatch(/Hermes|Karmenai|weho|MiniMax|\bNAS\b/i)
    expect(messages[0]?.content).toContain("小林")
    expect(messages[0]?.content).toContain("<ticket>")
    expect(messages[0]?.content).toContain("邮箱必须先征得同意")
    expect(messages[0]?.content).not.toContain("工作台")
    expect(messages[0]?.content).not.toContain("权限边界")
    expect(messages.at(-1)?.content).toContain("水稻")
    expect(messages[0]?.content.length).toBeLessThanOrEqual(1800)
  })

  it("puts shared desk memory on the turn without changing the last speaker", () => {
    const extra = `【长期记忆（与后台共用）】\n本周报价以FOB马尼拉为准。\n${"同步字段。".repeat(80)}`
    const history = withSyncedMemory([{ role: "user", content: "你好" }], extra)
    expect(history[0]?.content).toContain("已与后台同步")
    expect(history[0]?.content).toContain("FOB马尼拉")
    expect(extra.length).toBeGreaterThan(400)
    expect(history.at(-1)).toEqual({ role: "user", content: "你好" })
  })

  it("repeats the visitor question when escalating from an assistant greeting", () => {
    const history = hermesHistoryForGateway(
      [
        { role: "user", content: "水稻怎么用火山灰？" },
        { role: "assistant", content: "您好，我是小林。" },
      ],
      "zh",
      true,
    )
    expect(history.at(-1)).toEqual({ role: "user", content: "水稻怎么用火山灰？" })
    expect(hermesHistoryForGateway([{ role: "assistant", content: "您好，我是小林。" }], "zh", true).at(-1)?.content).toMatch(
      /皮纳图博火山灰/,
    )
    expect(hermesHistoryForGateway([{ role: "user", content: "你好" }], "zh", true).at(-1)?.role).toBe("user")
  })

  it("scrubs denied aliases from the gateway prompt but keeps Linda", () => {
    const extra = `【长期记忆（与后台共用）】\n${"本周报价以FOB马尼拉为准。".repeat(40)}`
    const messages = buildHermesMessages(
      [{ role: "user", content: "Hermes 还在吗" }],
      "项目文案",
      extra,
      ["Linda", "Hermes"],
    )
    expect(messages[0]?.content).not.toMatch(/Hermes|weho|MiniMax|\bNAS\b/i)
    expect(messages[0]?.content).toContain("Linda")
    expect(messages.some((item) => item.content.includes("FOB马尼拉"))).toBe(true)
    expect(extra.length).toBeGreaterThan(400)
    expect(messages[1]?.content).not.toMatch(/Hermes/i)
  })

  it("explains the handoff without leaking deploy details", () => {
    expect(hermesHandoffHint("zh")).toContain("接手")
    expect(hermesHandoffHint("en")).toMatch(/take over|handoff/i)
    expect(hermesUnavailableReply("zh")).toContain("还没接通")
    expect(hermesUnavailableReply("en")).toMatch(/not on this line/i)
    expect(hermesUnavailableReply("zh")).not.toMatch(/192\.168|cloudflare|tunnel|联络|冲凉|作物和吨位/)
    expect(hermesReconnectingReply("zh")).toContain("正在重新连接")
    expect(hermesReconnectingReply("zh")).not.toMatch(/联络|冲凉|作物和吨位|内网/)
    expect(isAdvisorOutageJoke("高级顾问正在冲凉 无法连接成功")).toBe(true)
    expect(isAdvisorOutageJoke("我是 Linda，后面我来跟您谈。")).toBe(false)
  })
})

describe("resolveHermesReply", () => {
  it("returns the configuring message when Hermes is not wired", async () => {
    const result = await resolveHermesReply(
      [{ role: "user", content: "转高级顾问" }],
      flattenKnowledge(defaultContent),
      {},
      undefined,
      "zh",
    )
    expect(result.source).toBe("local")
    expect(result.reply).toBe(hermesUnavailableReply("zh"))
    expect(result.ticket).toBeNull()
  })

  it("greets after a handoff instead of saying the advisor is unavailable", async () => {
    const result = await resolveHermesReply(
      [{ role: "user", content: "转高级顾问" }],
      flattenKnowledge(defaultContent),
      {},
      undefined,
      "zh",
      { escalate: true },
    )
    expect(result.reply).toBe(hermesHandoffGreeting("zh"))
    expect(result.reply).toContain("Linda")
    expect(result.reply).not.toMatch(/无法接入|Karmenai|内网|Hermes/)
    expect(result.reconnecting).toBe(false)
  })

  it("asks the visitor to wait instead of sending them to contact when the gateway fails", async () => {
    const result = await resolveHermesReply(
      [{ role: "user", content: "你好" }],
      flattenKnowledge(defaultContent),
      { HERMES_API_BASE: "https://127.0.0.1:1/v1", HERMES_API_KEY: "local" },
      undefined,
      "zh",
      { timeoutMs: 800 },
    )
    expect(result.source).toBe("local")
    expect(result.reconnecting).toBe(true)
    expect(result.reply).toBe(hermesReconnectingReply("zh"))
    expect(result.reply).not.toMatch(/联络|作物和吨位|冲凉/)
  })

  it("keeps a real Linda reply that mentions crops and tonnage", async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ source: "hermes", reply: "水稻可以先按作物和吨位谈供应。" }), { status: 200 })
    try {
      const result = await resolveHermesReply(
        [{ role: "user", content: "水稻怎么用？" }],
        flattenKnowledge(defaultContent),
        { SIGNED_GUIDE_FALLBACK: "1" },
        undefined,
        "zh",
      )
      expect(result.source).toBe("hermes")
      expect(result.reply).toContain("作物和吨位")
    } finally {
      globalThis.fetch = original
    }
  })

  it("hands off the last real visitor question instead of the transfer phrase", async () => {
    const original = globalThis.fetch
    let body: Record<string, unknown> | null = null
    globalThis.fetch = async (_input, init) => {
      body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>
      return new Response(JSON.stringify({ source: "hermes", reply: "您好，我是 Linda，香蕉园可以先看钾钙镁。" }), { status: 200 })
    }
    try {
      const result = await resolveHermesReply(
        [
          { role: "user", content: "香蕉园能不能用火山灰？" },
          { role: "assistant", content: "可以先看土壤。" },
          { role: "user", content: "转高级顾问" },
        ],
        flattenKnowledge(defaultContent),
        { SIGNED_GUIDE_FALLBACK: "1" },
        "客户要求转接高级顾问。你现在是 Linda。\n【长期记忆（与后台共用）】\n本周报价以FOB马尼拉为准。",
        "zh",
        { escalate: true },
      )
      expect(result.source).toBe("hermes")
      const messages = body?.messages as { content?: string }[]
      const packed = messages?.map((item) => item.content).join("\n") || ""
      expect(packed).toContain("香蕉园")
      expect(packed).toContain("FOB马尼拉")
      expect(packed).not.toContain("你现在是 Linda")
      expect(packed).not.toMatch(/客户刚说：转高级顾问/)
    } finally {
      globalThis.fetch = original
    }
  })

  it("sends workbench backup turns as an on-topic Linda handoff", async () => {
    const original = globalThis.fetch
    let body: Record<string, unknown> | null = null
    globalThis.fetch = async (_input, init) => {
      body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>
      return new Response(JSON.stringify({ source: "hermes", reply: "收到，先按作物跟进。" }), { status: 200 })
    }
    try {
      const result = await resolveCoachViaSignedGuide("先问王先生作物", "【长期记忆】报价按吨位谈")
      expect(result?.source).toBe("hermes")
      expect(body?.advisor).toBe("hermes")
      expect(body?.escalate).toBe(true)
      const messages = body?.messages as { content?: string }[]
      expect(messages?.some((item) => item.content?.includes("皮纳图博火山灰"))).toBe(true)
      expect(messages?.some((item) => item.content?.includes("先问王先生作物"))).toBe(true)
      expect(messages?.some((item) => item.content?.includes("报价按吨位谈"))).toBe(true)
    } finally {
      globalThis.fetch = original
    }
  })

  it("uses the signed backup when live keys are missing", async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ source: "hermes", reply: "您好，我是 Linda，水稻可以先从吨位谈。" }), { status: 200 })
    try {
      const result = await resolveHermesReply(
        [{ role: "user", content: "水稻怎么用？" }],
        flattenKnowledge(defaultContent),
        { SIGNED_GUIDE_FALLBACK: "1" },
        "【长期记忆（与后台共用）】\n本周报价以FOB马尼拉为准。",
        "zh",
      )
      expect(result.source).toBe("hermes")
      expect(result.reply).toContain("Linda")
      expect(result.reply).not.toBe(hermesUnavailableReply("zh"))
    } finally {
      globalThis.fetch = original
    }
  })
})
