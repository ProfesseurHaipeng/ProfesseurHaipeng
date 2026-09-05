import { describe, expect, it } from "vitest"
import { createInquiryTask, emptyInquiry, startInquiryTask } from "./inquiryDesk"
import {
  classifyInquiryCoachCommand,
  composeOutreachMail,
  extractPublicEmails,
  harvestTaskSeeds,
  isPublicBusinessEmail,
  parseSearchHtml,
  resolveMailbox,
  runInquiryCoachCommand,
  runInquiryRound,
  shouldRerunInquiry,
  unwrapSearchUrl,
} from "./inquiryOutreach"

const now = "2026-09-05T12:00:00.000Z"

const pageHtml = `<html><title>绿田农业合作社</title><body>
<p>欢迎来到绿田农业。</p>
<a href="mailto:sales@lvtian-agri.com">sales@lvtian-agri.com</a>
</body></html>`

const searchHtml = `<a class="result__a" href="https://www.lvtian-agri.com/contact">绿田农业</a>`

function mockFetch(routes: { test: (url: string) => boolean; body?: string; status?: number; headers?: Record<string, string> }[]) {
  return async (input: RequestInfo | URL) => {
    const url = String(input)
    const hit = routes.find((item) => item.test(url))
    if (!hit) return new Response("", { status: 404 })
    return new Response(hit.body || "", {
      status: hit.status || 200,
      headers: hit.headers,
    })
  }
}

describe("inquiry outreach runner", () => {
  it("extracts only publicly listed business emails", () => {
    const emails = extractPublicEmails(
      '联系 mailto:sales@lvtian-agri.com 以及 noreply@lvtian-agri.com 和 photo@cdn.googleusercontent.com 还有 user@example.com',
    )
    expect(emails).toEqual(["sales@lvtian-agri.com"])
    expect(isPublicBusinessEmail("noreply@factory.cn")).toBe(false)
    expect(isPublicBusinessEmail("sales@lvtian-agri.com")).toBe(true)
    expect(isPublicBusinessEmail("954970ecd1ec4429ba733caf5feafd54@glitchtip.7gra.us")).toBe(false)
  })

  it("parses search result links and composes a product promo mail", () => {
    const hits = parseSearchHtml(searchHtml)
    expect(hits[0]?.url).toContain("lvtian-agri.com")
    const mail = composeOutreachMail({
      org: "绿田农业合作社",
      email: "sales@lvtian-agri.com",
      pain: "土壤板结",
      siteUrl: "https://modeltest.store",
    })
    expect(mail.to).toBe("sales@lvtian-agri.com")
    expect(mail.subject).toContain("皮纳图博火山灰")
    expect(mail.text).toContain("皮纳图博火山灰")
    expect(mail.text).toContain("https://modeltest.store")
    expect(mail.text).toContain("土壤板结")
    expect(mail.text).toContain("菲律宾皮纳图博火山灰农业综合产业项目")
  })

  it("does not resolve a mailbox from empty env", () => {
    expect(resolveMailbox({}).kind).toBe("none")
    expect(resolveMailbox({ SENDGRID_API_KEY: "sg", SENDGRID_FROM: "from@modeltest.store" }).kind).toBe("sendgrid")
    expect(
      resolveMailbox({
        HERMES_API_BASE: "https://advisor.example.com/v1",
        HERMES_API_KEY: "hk-test",
      }).kind,
    ).toBe("hermes")
    expect(resolveMailbox({ HERMES_API_BASE: "https://advisor.example.com/v1" }).kind).toBe("hermes")
    expect(shouldRerunInquiry("再找一轮")).toBe(true)
    expect(shouldRerunInquiry("工单情况")).toBe(false)
  })

  it("drafts promo mail from a public page when no mailbox is hooked", async () => {
    const created = createInquiryTask(emptyInquiry(), { name: "土壤板结一轮", targets: ["土壤板结"], quota: 5 }, now)
    const started = startInquiryTask(created.state, created.task!.id, now)
    const run = await runInquiryRound({
      inquiry: started.state,
      task: started.task!,
      env: {},
      now,
      siteUrl: "https://modeltest.store",
      fetchImpl: mockFetch([
        { test: (url) => url.includes("duckduckgo") || url.includes("bing.com"), body: searchHtml },
        { test: (url) => url.includes("lvtian-agri.com"), body: pageHtml },
      ]) as typeof fetch,
    })
    expect(run.searched).toBeGreaterThan(0)
    expect(run.findings[0]?.contact).toBe("sales@lvtian-agri.com")
    expect(run.findings[0]?.source).toContain("lvtian-agri.com")
    expect(run.findings[0]?.outreach).toBe("draft")
    expect(run.findings[0]?.draft).toContain("皮纳图博火山灰")
    expect(run.findings[0]?.draft).toContain("https://modeltest.store")
    expect(run.sent).toBe(0)
    expect(run.report).toContain("公开邮箱")
    expect(run.report).toContain("没读到发出信箱")
    expect(run.inquiry.job.status).toBe("drafting")
    expect(run.inquiry.findings).toHaveLength(1)
  })

  it("marks sent only when the mailbox returns a receipt", async () => {
    const created = createInquiryTask(emptyInquiry(), { name: "土壤板结一轮", targets: ["土壤板结"] }, now)
    const started = startInquiryTask(created.state, created.task!.id, now)
    const run = await runInquiryRound({
      inquiry: started.state,
      task: started.task!,
      env: { SENDGRID_API_KEY: "sg-test", SENDGRID_FROM: "outreach@modeltest.store" },
      now,
      fetchImpl: mockFetch([
        { test: (url) => url.includes("duckduckgo") || url.includes("bing.com"), body: searchHtml },
        { test: (url) => url.includes("lvtian-agri.com"), body: pageHtml },
        {
          test: (url) => url.includes("api.sendgrid.com"),
          status: 202,
          body: "{}",
          headers: { "x-message-id": "sg-receipt-9" },
        },
      ]) as typeof fetch,
    })
    expect(run.findings[0]?.outreach).toBe("sent")
    expect(run.findings[0]?.receipt).toBe("sg-receipt-9")
    expect(run.sent).toBe(1)
    expect(run.report).toContain("邮局回执")
  })

  it("unwraps Bing redirect targets and harvests emails from the instruction", () => {
    const href =
      "https://www.bing.com/ck/a?!&&p=abc&u=a1aHR0cHM6Ly93d3cubHZ0aWFuLWFncmkuY29tL2NvbnRhY3Q&ntb=1"
    expect(unwrapSearchUrl(href)).toBe("https://www.lvtian-agri.com/contact")
    const created = createInquiryTask(
      emptyInquiry(),
      { name: "一轮", instruction: "先写给 sales@lvtian-agri.com，官网 https://www.lvtian-agri.com/contact", targets: ["土壤板结"] },
      now,
    )
    const seeds = harvestTaskSeeds(created.task!)
    expect(seeds.emails).toEqual(["sales@lvtian-agri.com"])
    expect(seeds.urls.some((item) => item.includes("lvtian-agri.com"))).toBe(true)
  })

  it("drafts from an email the colleague wrote, even when search is empty", async () => {
    const created = createInquiryTask(
      emptyInquiry(),
      { name: "一轮", instruction: "公开邮箱 sales@lvtian-agri.com", targets: ["土壤板结"] },
      now,
    )
    const started = startInquiryTask(created.state, created.task!.id, now)
    const run = await runInquiryRound({
      inquiry: started.state,
      task: started.task!,
      env: {},
      now,
      fetchImpl: mockFetch([]) as typeof fetch,
    })
    expect(run.findings[0]?.contact).toBe("sales@lvtian-agri.com")
    expect(run.findings[0]?.source).toBe("同事补充指令")
    expect(run.findings[0]?.draft).toContain("https://modeltest.store")
    expect(run.findings[0]?.outreach).toBe("draft")
  })

  it("runs a directed send from chat instead of asking for the recipient again", async () => {
    expect(classifyInquiryCoachCommand("bear131419@163.com 给这个邮箱去发个邮件")).toBe("send")
    expect(
      classifyInquiryCoachCommand(
        "按这些真实需求去找厂商：农产品 / 农业、农村合作社、肥料 / 土壤改良厂家。本轮最多找 20 家带真实来源的厂商。",
      ),
    ).toBe("search")
    const run = await runInquiryCoachCommand({
      message: "bear131419@163.com 给这个邮箱去发个邮件",
      inquiry: emptyInquiry(),
      env: {},
      now,
      fetchImpl: mockFetch([]) as typeof fetch,
    })
    expect(run?.findings[0]?.contact).toBe("bear131419@163.com")
    expect(run?.findings[0]?.draft).toContain("皮纳图博火山灰")
    expect(run?.findings[0]?.outreach).toBe("draft")
    expect(run?.sent).toBe(0)
    expect(run?.report).not.toContain("请告诉我收件人")
    expect(run?.report).toContain("bear131419@163.com")
    expect(run?.report).toContain("没读到发出信箱")
    const again = await runInquiryCoachCommand({
      message: "bear131419@163.com 给这个邮箱去发个邮件",
      inquiry: run!.inquiry,
      env: {},
      now,
      fetchImpl: mockFetch([]) as typeof fetch,
    })
    expect(again?.report).toContain("bear131419@163.com")
    expect(again?.report).not.toContain("没有可发的公开邮箱")
    expect(again?.findings[0]?.contact).toBe("bear131419@163.com")
  })

  it("treats the WEHO Hermes gateway as the outgoing mailbox", async () => {
    const run = await runInquiryCoachCommand({
      message: "bear131419@163.com 给这个邮箱去发个邮件",
      inquiry: emptyInquiry(),
      env: {
        HERMES_API_BASE: "https://advisor.example.com/v1",
        HERMES_API_KEY: "hk-test",
      },
      now,
      fetchImpl: mockFetch([
        {
          test: (url) => url.includes("/send"),
          status: 200,
          body: JSON.stringify({ id: "weho-mail-7" }),
        },
      ]) as typeof fetch,
    })
    expect(run?.findings[0]?.contact).toBe("bear131419@163.com")
    expect(run?.findings[0]?.outreach).toBe("sent")
    expect(run?.findings[0]?.receipt).toBe("weho-mail-7")
    expect(run?.sent).toBe(1)
    expect(run?.report).toContain("WEHO 已配置的发出信箱")
    expect(run?.report).not.toContain("没读到发出信箱")
  })

  it("does not claim the mailbox is missing when Hermes is wired but send has no receipt", async () => {
    const run = await runInquiryCoachCommand({
      message: "bear131419@163.com 给这个邮箱去发个邮件",
      inquiry: emptyInquiry(),
      env: { HERMES_API_BASE: "https://advisor.example.com/v1", HERMES_API_KEY: "hk-test" },
      now,
      fetchImpl: mockFetch([]) as typeof fetch,
    })
    expect(run?.findings[0]?.outreach).toBe("draft")
    expect(run?.sent).toBe(0)
    expect(run?.report).toContain("WEHO 发出信箱已配置")
    expect(run?.report).not.toContain("没读到发出信箱")
    expect(run?.report).not.toContain("请告诉我收件人")
  })

  it("does not invent emails when search returns nothing", async () => {
    const created = createInquiryTask(emptyInquiry(), { name: "一轮", instruction: "找肥料厂公开邮箱" }, now)
    const started = startInquiryTask(created.state, created.task!.id, now)
    const run = await runInquiryRound({
      inquiry: started.state,
      task: started.task!,
      env: {},
      now,
      fetchImpl: mockFetch([]) as typeof fetch,
    })
    expect(run.findings).toHaveLength(0)
    expect(run.sent).toBe(0)
    expect(run.inquiry.findings).toHaveLength(0)
    expect(run.report).toContain("没有编造")
    expect(run.inquiry.job.status).toBe("searching")
  })
})
