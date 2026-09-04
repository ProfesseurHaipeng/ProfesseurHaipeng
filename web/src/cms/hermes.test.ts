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
  hermesUnavailableReply,
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
  })

  it("treats a missing gateway as disconnected", async () => {
    const health = await probeHermes({})
    expect(health.status).toBe("disconnected")
    expect(health.detail).toContain("HERMES_API_BASE")
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
    expect(messages[0]?.content).not.toMatch(/我是 Hermes|I'm Hermes|高级顾问 Hermes/)
    expect(messages[0]?.content).toContain("小林")
    expect(messages[0]?.content).toContain("<ticket>")
    expect(messages[0]?.content).toContain("邮箱必须先征得同意")
    expect(messages[0]?.content).toContain("工作群")
    expect(messages[0]?.content).toContain("不要提 NAS")
    expect(messages[0]?.content).toContain("工作台")
    expect(messages[0]?.content).toContain("权限边界")
    expect(messages.at(-1)?.content).toContain("水稻")
  })

  it("explains the handoff without leaking deploy details", () => {
    expect(hermesHandoffHint("zh")).toContain("接手")
    expect(hermesHandoffHint("en")).toMatch(/take over|handoff/i)
    expect(hermesUnavailableReply("zh")).toContain("内网")
    expect(hermesUnavailableReply("en")).toContain("private network")
    expect(hermesUnavailableReply("zh")).not.toMatch(/192\.168|cloudflare|tunnel/i)
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
  })
})
