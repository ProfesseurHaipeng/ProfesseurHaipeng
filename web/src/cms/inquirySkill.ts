import type { InquiryFinding, InquiryState, InquiryWorkEvent } from "./inquiryDesk"

export const INQUIRY_SKILL = {
  name: "询单工位操作技能",
  steps: [
    {
      key: "collect",
      title: "取条件",
      detail: "按同事定的厂家类型和痛点工作。不向同事要收件人。",
    },
    {
      key: "source",
      title: "找客户",
      detail: "在公开网页上找肥料厂、合作社、农产品加工厂这类客户。跳过政府门户、新闻站和零售品牌。只收录页面上真实出现的厂商邮箱。",
    },
    {
      key: "draft",
      title: "写推广信",
      detail: "用本站皮纳图博火山灰和官网写短信。不编检测数字，不编厂商。",
    },
    {
      key: "send",
      title: "真实发出",
      detail: "走已配置的 WEHO 发出信箱，发给找到的厂商。有邮局回执才算已发送。同事个人邮箱只作发出测试。",
    },
    {
      key: "report",
      title: "留下记录",
      detail: "每一步写入操作日志。同事打开询单页就能看做到哪一步、发给了谁。问日报或周报时按真实结果回答。",
    },
  ],
}

export function inquirySkillExcerpt() {
  return INQUIRY_SKILL.steps.map((item) => `${item.title}：${item.detail}`).join("\n")
}

export function describeWorkbench(kind: "local" | "remote" | "none") {
  if (kind === "remote") {
    return "本轮接到了询单工作台，搜索和发信按工作台回执记账，不会空口说做完。"
  }
  if (kind === "none") {
    return "本轮没有发出信箱，也没有接到 NAS / 沙箱工作台。寻找仍是真实打开公开网页，发信只入队为草稿。"
  }
  return "本轮在本站询单执行器里真实上网搜索并尝试发信。NAS / 沙箱工作台还没接到本站，不会假装已经在虚拟机里做完。"
}

export type OutreachDigestRange = "day" | "week"

export type OutreachDigest = {
  range: OutreachDigestRange
  since: string
  sent: InquiryFinding[]
  drafted: InquiryFinding[]
  tests: InquiryFinding[]
  text: string
}

function inRange(iso: string, sinceMs: number) {
  const at = Date.parse(iso)
  return Number.isFinite(at) && at >= sinceMs
}

export function digestWindow(range: OutreachDigestRange, now = new Date()) {
  const since = new Date(now)
  if (range === "week") since.setDate(since.getDate() - 7)
  else since.setHours(0, 0, 0, 0)
  return since
}

export function buildOutreachDigest(
  inquiry: InquiryState,
  range: OutreachDigestRange,
  now = new Date(),
): OutreachDigest {
  const since = digestWindow(range, now)
  const sinceMs = since.getTime()
  const rows = inquiry.findings.filter((item) => item.contact && inRange(item.at, sinceMs))
  const tests = rows.filter((item) => item.source === "同事测试指令")
  const factory = rows.filter((item) => item.source !== "同事测试指令")
  const sent = factory.filter((item) => item.outreach === "sent" && item.receipt)
  const drafted = factory.filter((item) => item.outreach === "draft" || item.outreach === "queued")
  const label = range === "week" ? "近 7 天" : "今天"
  const lines = [
    `${label}发出报告（只记真实结果）：`,
    sent.length
      ? `已发出 ${sent.length} 封，都有邮局回执：${sent.map((item) => `${item.org} <${item.contact}>`).join("、")}。`
      : `${label}还没有一封带着邮局回执的厂商信。`,
    drafted.length
      ? `已起草未发出 ${drafted.length} 封：${drafted.map((item) => `${item.org} <${item.contact}>`).join("、")}。`
      : "",
    tests.length ? `另有发给同事的测试信 ${tests.length} 封，不算厂商询单。` : "",
  ]
  return {
    range,
    since: since.toISOString(),
    sent,
    drafted,
    tests,
    text: lines.filter(Boolean).join("\n"),
  }
}

export function formatWorkJournal(events: InquiryWorkEvent[], limit = 24) {
  if (!events.length) return "还没有操作日志。开始询单后，寻找、跳过、起草和发信都会写在这里。"
  return events
    .slice(-limit)
    .map((item) => `${clock(item.at)} · ${workKindLabel(item.kind)} · ${item.text}`)
    .join("\n")
}

export function workKindLabel(kind: InquiryWorkEvent["kind"]) {
  if (kind === "think") return "思路"
  if (kind === "search") return "搜索"
  if (kind === "skip") return "跳过"
  if (kind === "open") return "打开"
  if (kind === "found") return "找到"
  if (kind === "draft") return "起草"
  if (kind === "send") return "尝试发出"
  if (kind === "sent") return "已发出"
  if (kind === "fail") return "未发出"
  return "记下"
}

function clock(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "尚无"
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${hour}:${minute}`
}
