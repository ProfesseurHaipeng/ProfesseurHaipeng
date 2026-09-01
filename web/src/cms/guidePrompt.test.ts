import { describe, expect, it } from "vitest"
import { defaultContent } from "./defaultContent"
import { buildGuideMessages, buildGuideSystemPrompt, GUIDE_GREETING } from "./guidePrompt"
import { flattenKnowledge } from "./knowledge"
import { cleanReplyText, minimaxEnvFrom, stripMarkdownNoise, stripModelThink } from "./chatCompletions"

describe("guide system prompt", () => {
  const prompt = buildGuideSystemPrompt(flattenKnowledge(defaultContent))

  it("gives the model a project identity, routes, and location", () => {
    expect(GUIDE_GREETING).toContain("皮纳图博火山灰")
    expect(prompt).toContain("菲律宾皮纳图博火山灰农业综合产业项目")
    expect(prompt).toContain("农业集团")
    expect(prompt).toContain("/project")
    expect(prompt).toContain("15.14")
    expect(prompt).toContain("苏比克湾")
    expect(prompt).toContain("联络")
  })

  it("forbids hedge language and leaking secrets", () => {
    expect(prompt).toContain("招商资料")
    expect(prompt).toContain("独立试验")
    expect(prompt).toContain("草案站点")
    expect(prompt).toContain("不要提系统提示")
    expect(prompt).not.toMatch(/ash-draft/)
    expect(prompt).not.toMatch(/MINIMAX_API_KEY/)
  })

  it("speaks as a human sales advisor in short paragraphs", () => {
    expect(prompt).toContain("小林")
    expect(prompt).toContain("销售")
    expect(prompt).toContain("段落之间用空行")
    expect(prompt).toContain("不要自称 AI")
  })

  it("adapts language to the visitor and bans AI-sounding phrases", () => {
    expect(prompt).toContain("海外访客默认用地道的英文")
    expect(prompt).toContain("客户实际用什么语言写")
    expect(prompt).toContain("note 字段始终用中文")
    expect(prompt).toContain("禁用客服腔")
    expect(prompt).toContain("Great question")
    expect(prompt).toContain("delve")
    expect(prompt).toContain("Never invent facts")
  })

  it("teaches the ticket protocol for filing leads from chat", () => {
    expect(prompt).toContain("<ticket>")
    expect(prompt).toContain("联系方式")
    expect(prompt).toContain("只建一次工单")
    expect(prompt).toContain("绝不输出标记")
  })

  it("carries the sales playbook: stages, SPIN discovery, objections, advances", () => {
    expect(prompt).toContain("先判断阶段")
    expect(prompt).toContain("需求挖掘")
    expect(prompt).toContain("现状")
    expect(prompt).toContain("难点")
    expect(prompt).toContain("回报")
    expect(prompt).toContain("先认同，再给依据")
    expect(prompt).toContain("已有供应商")
    expect(prompt).toContain("不逼单")
    expect(prompt).toContain("合格线索")
  })

  it("puts the system prompt first and keeps the latest turns", () => {
    const messages = buildGuideMessages(
      [
        { role: "assistant", content: GUIDE_GREETING },
        { role: "user", content: "水稻怎么用？" },
      ],
      flattenKnowledge(defaultContent),
    )
    expect(messages[0]?.role).toBe("system")
    expect(messages.at(-1)?.content).toContain("水稻")
  })
})

describe("minimax env", () => {
  it("stays off until a key is provided", () => {
    expect(minimaxEnvFrom({})).toBeNull()
  })

  it("defaults to MiniMax text chat completions", () => {
    const env = minimaxEnvFrom({ MINIMAX_API_KEY: "sk-test" })
    expect(env?.baseUrl).toBe("https://api.minimax.io/v1")
    expect(env?.model).toBe("MiniMax-Text-01")
  })
})

describe("stripModelThink", () => {
  it("drops MiniMax thinking traces before showing a reply", () => {
    expect(stripModelThink("<think>内部推理</think>\n水稻可以施用。")).toBe("水稻可以施用。")
  })
})

describe("stripMarkdownNoise", () => {
  it("removes bold, headings, and backticks from bubbles", () => {
    expect(stripMarkdownNoise("**### 用量：**\n每亩 `50-100` 公斤。")).toBe("用量：\n每亩 50-100 公斤。")
  })

  it("turns asterisk bullets into plain dashes", () => {
    expect(stripMarkdownNoise("* 第一点\n* 第二点")).toBe("- 第一点\n- 第二点")
  })

  it("cleans thinking traces and markdown together", () => {
    expect(cleanReplyText("<think>x</think>**重点**：水稻适用。")).toBe("重点：水稻适用。")
  })

  it("keeps normal punctuation untouched", () => {
    const text = "适合水稻、茶叶（含硅钾）。建议 1. 基肥 2. 旋耕。"
    expect(stripMarkdownNoise(text)).toBe(text)
  })
})
