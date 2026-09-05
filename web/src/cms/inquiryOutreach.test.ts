import { describe, expect, it } from "vitest"
import { createInquiryTask, emptyInquiry, startInquiryTask } from "./inquiryDesk"
import {
  composeOutreachMail,
  extractPublicEmails,
  isPublicBusinessEmail,
  parseSearchHtml,
  resolveMailbox,
  runInquiryRound,
  shouldRerunInquiry,
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
    expect(run.report).toContain("还没挂询单发出信箱")
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
