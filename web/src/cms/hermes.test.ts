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
  resolveHermesReply,
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
  })
})

describe("hermes prompt", () => {
  it("speaks as senior advisor Karmenai taking over from 小林", () => {
    const messages = buildHermesMessages(
      [
        { role: "assistant", content: "您好，我是小林。" },
        { role: "user", content: "水稻怎么用？" },
      ],
      flattenKnowledge(defaultContent),
    )
    expect(messages[0]?.role).toBe("system")
    expect(messages[0]?.content).toContain("Karmenai")
    expect(messages[0]?.content).not.toMatch(/Hermes|Linda|weho|MiniMax|\bNAS\b/i)
    expect(messages[0]?.content).toContain("小林")
    expect(messages[0]?.content).toContain("<ticket>")
    expect(messages[0]?.content).toContain("邮箱必须先征得同意")
    expect(messages[0]?.content).not.toContain("工作台")
    expect(messages[0]?.content).not.toContain("权限边界")
    expect(messages.at(-1)?.content).toContain("水稻")
    expect(messages[0]?.content.length).toBeLessThanOrEqual(1800)
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

  it("scrubs denied aliases from the gateway prompt", () => {
    const messages = buildHermesMessages(
      [{ role: "user", content: "Hermes 还在吗" }],
      "项目文案",
      "不要提 Linda",
      ["Linda"],
    )
    expect(messages[0]?.content).not.toMatch(/Hermes|Linda|weho|MiniMax|\bNAS\b/i)
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
    expect(isAdvisorOutageJoke("我是 Karmenai，后面我来跟您谈。")).toBe(false)
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
    expect(result.reply).toContain("Karmenai")
    expect(result.reply).not.toMatch(/无法接入|Linda|内网|Hermes/)
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
})
