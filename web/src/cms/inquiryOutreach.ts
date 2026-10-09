import {
  appendInquiryJournal,
  applyInquiryFindings,
  asQuota,
  buildTaskAssignMessage,
  createInquiryTask,
  currentInquiryTask,
  NEED_PRESETS,
  newInquiryId,
  startInquiryTask,
  updateInquiryTask,
  type InquiryFinding,
  type InquiryJobStatus,
  type InquiryState,
  type InquiryTask,
  type InquiryWorkEvent,
} from "./inquiryDesk"
import { buildOutreachDigest, buildOutreachRoster, describeWorkbench, formatWorkJournal } from "./inquirySkill"

export const DEFAULT_SITE_URL = "https://modeltest.store"

export const OUTREACH_BRIEF = {
  projectName: "菲律宾皮纳图博火山灰农业综合产业项目",
  productName: "皮纳图博火山灰",
  siteUrl: DEFAULT_SITE_URL,
  pitch: "天然火山灰矿物，弱碱性，用于土壤改良、肥料基料和生态农业。检测报告可随货核对。",
}

export type OutreachMailbox =
  | { kind: "agentmail"; apiKey: string; inboxId: string; baseUrl: string; from?: string }
  | { kind: "sendgrid"; apiKey: string; from: string }
  | { kind: "webhook"; url: string; token?: string; from?: string }
  | { kind: "hermes"; apiKey: string; baseUrl: string; model: string; from?: string }
  | { kind: "none" }

export type InquiryCoachKind = "send" | "search" | "status" | "report"

export type SearchHit = {
  title: string
  url: string
  snippet: string
  channel?: string
}

export type OutreachMail = {
  to: string
  subject: string
  text: string
}

export type InquiryRoundResult = {
  inquiry: InquiryState
  findings: InquiryFinding[]
  report: string
  searched: number
  pages: number
  drafted: number
  sent: number
  queued: number
  nextAction: string
}

type FetchLike = typeof fetch

const SEARCH_UA = "Mozilla/5.0 (compatible; PinatuboInquiry/1.0; +https://modeltest.store)"
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/g
const MAILTO_RE = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24})/gi

const BLOCKED_HOST = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "email.com",
  "domain.com",
  "yourdomain.com",
  "sentry.io",
  "wixpress.com",
  "wix.com",
  "googleusercontent.com",
  "googleapis.com",
  "gstatic.com",
  "cloudflare.com",
  "w3.org",
  "schema.org",
  "github.com",
  "githubusercontent.com",
  "duckduckgo.com",
  "bing.com",
  "microsoft.com",
  "google.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "linkedin.com",
  "agentmail.to",
  "glitchtip.com",
  "bugsnag.com",
  "rollbar.com",
  "alibaba.com",
  "1688.com",
  "made-in-china.com",
  "globalsources.com",
])

const JUNK_RESULT_HOST = new Set([
  ...BLOCKED_HOST,
  "r.bing.com",
  "th.bing.com",
  "go.microsoft.com",
  "stackoverflow.com",
  "stackexchange.com",
  "reddit.com",
  "quora.com",
  "wikipedia.org",
  "youtube.com",
  "nytimes.com",
  "bbc.co.uk",
  "msn.com",
  "shopify.com",
  "myshopify.com",
  "oldnavy.com",
  "gap.com",
  "nike.com",
  "adidas.com",
  "amazon.com",
  "amazon.cn",
  "taobao.com",
  "tmall.com",
  "jd.com",
  "suning.com",
  "walmart.com",
  "target.com",
  "uniqlo.com",
  "zara.com",
  "xinhuanet.com",
  "people.com.cn",
  "cctv.com",
  "china.com.cn",
  "chinanews.com",
  "thepaper.cn",
  "caixin.com",
  "alibaba.com",
  "1688.com",
  "made-in-china.com",
  "globalsources.com",
  "baidu.com",
  "so.com",
  "sogou.com",
  "zhihu.com",
  "csdn.net",
  "docin.com",
  "doc88.com",
  "book118.com",
])

const GOV_HOST =
  /(^|\.)gov(\.[a-z]{2,})?$|(^|\.)gob(\.[a-z]{2,})?$|(^|\.)go\.[a-z]{2}$|(^|\.)gov\.cn$|(^|\.)gov\.ph$|moa\.gov|usda\.gov|agriculture\.gov/i
const GOV_TEXT =
  /人民政府|农业农村|工信局|商务局|统计局|海关|税务|市场监管|门户网站|政府网|政务服务|发改委|国务院|省政府|市政府|县政府|乡政府|镇政府|ministry of|department of agriculture|official (government )?portal/i
const BUYER_HINT =
  /肥|土壤|农|合作社|茶|米|稻|种植|有机|农资|基地|园艺|果蔬|畜牧|饲料|改良|加工厂|fertil|agri|farm|coop|soil|compost|manure|organic|tea|rice|plantation/i
const COMPANY_HINT = /公司|厂|合作社|基地|有限|集团|co\.|ltd|inc|gmbh/i

const BLOCKED_LOCAL = /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|webmaster|abuse|privacy|legal|newsletter|news|image|img|static|assets|webpack|sentry|wix|custserv|customerservice|customer-service|customercare|support|helpdesk|help|careers|jobs|hr|press|media|pr|billing|invoice)$/i
const PLACEHOLDER_LOCAL = /^(name|email|user|username|someone|foo|bar|sample|xxx|mailbox)$/i
const HASH_LOCAL = /^[a-f0-9]{20,}$/i
const TRACKER_HOST = /(^|\.)(glitchtip|sentry|bugsnag|rollbar)(\.|$)/i
const CONSUMER_MAIL_HOST = new Set([
  "163.com",
  "126.com",
  "yeah.net",
  "qq.com",
  "foxmail.com",
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "sina.com",
  "sina.cn",
  "sohu.com",
  "139.com",
  "189.cn",
  "aliyun.com",
  "188.com",
])

export function resolveSiteUrl(env: Record<string, string | undefined> = {}) {
  for (const raw of [env.PUBLIC_SITE_URL, env.SITE_URL]) {
    const text = String(raw || "").trim().replace(/\/$/, "")
    if (!/^https?:\/\//i.test(text)) continue
    try {
      const host = new URL(text).hostname
      if (host && !/\.netlify\.app$/i.test(host)) return text
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_SITE_URL
}

export function resolveMailbox(env: Record<string, string | undefined> = {}): OutreachMailbox {
  const agentKey = pick(env, "AGENTMAIL_API_KEY", "HERMES_MAIL_API_KEY")
  const inboxId = pick(env, "AGENTMAIL_INBOX_ID", "HERMES_MAIL_INBOX_ID")
  const agentBase = pick(env, "AGENTMAIL_API_BASE") || "https://api.agentmail.to"
  const from = pick(env, "HERMES_MAIL_FROM", "SENDGRID_FROM", "INQUIRY_MAIL_FROM", "EMAIL_ADDRESS")
  if (agentKey && inboxId) {
    return { kind: "agentmail", apiKey: agentKey, inboxId, baseUrl: agentBase.replace(/\/$/, ""), from }
  }
  const sendKey = pick(env, "SENDGRID_API_KEY")
  if (sendKey && from) return { kind: "sendgrid", apiKey: sendKey, from }
  const hook = pick(env, "INQUIRY_MAIL_ENDPOINT", "HERMES_MAIL_ENDPOINT")
  if (hook) {
    return { kind: "webhook", url: hook, token: pick(env, "INQUIRY_MAIL_KEY", "HERMES_MAIL_API_KEY"), from }
  }
  const hermesBase = pick(env, "HERMES_API_BASE", "SENIOR_ADVISOR_API_BASE")
  const hermesKey = pick(env, "HERMES_API_KEY", "SENIOR_ADVISOR_API_KEY")
  // WEHO Hermes keeps the SMTP / AgentMail box on the gateway host.
  // A wired advisor base is enough to treat that box as configured.
  if (hermesBase) {
    return {
      kind: "hermes",
      apiKey: hermesKey && hermesKey !== "local" ? hermesKey : "local",
      baseUrl: hermesBase.replace(/\/$/, ""),
      model: pick(env, "HERMES_MODEL", "SENIOR_ADVISOR_MODEL") || "weho-senior-advisor",
      from,
    }
  }
  return { kind: "none" }
}

export function classifyInquiryCoachCommand(message: string): InquiryCoachKind | null {
  const text = message.replace(/\s+/g, " ").trim()
  if (!text) return null
  const emails = extractDirectedEmails(text)
  if (emails.length && /发(邮件|信)|写信|发给|寄给|给这个邮箱|去发|发个邮/.test(text)) return "send"
  if (/日报|周报|发给了谁|发出名单|做到哪一步|操作(思路|日志)|工作报告|发出报告/.test(text)) return "report"
  if (isInquiryStatusQuestion(text)) return "status"
  if (shouldRerunInquiry(text)) return "search"
  if (/开始询单|开始寻找|找公开邮箱|找厂商|找厂家|按这些真实需求|去网上找|跑起来|去做|开工/.test(text)) return "search"
  if (NEED_PRESETS.some((item) => text.includes(item.label)) && /找|询单|厂家|厂商/.test(text)) return "search"
  if (/询单|厂商|厂家|推广信/.test(text) && /开始|去找|执行|启动/.test(text)) return "search"
  if (/发(邮件|信)|发给|寄给|去发|发个邮|把(信|邮件|推广信)发出/.test(text)) return "send"
  return null
}

export function resolveWorkbench(env: Record<string, string | undefined> = {}) {
  const url = pick(env, "INQUIRY_WORKBENCH_URL", "INQUIRY_SANDBOX_URL")
  if (!url) return { kind: "local" as const }
  return { kind: "remote" as const, url: url.replace(/\/$/, ""), token: pick(env, "INQUIRY_WORKBENCH_KEY", "INQUIRY_SANDBOX_KEY") }
}

export function isGovernmentSource(url: string, title = "", snippet = "") {
  const host = hostOf(url)
  if (!host) return GOV_TEXT.test(`${title} ${snippet}`)
  if (GOV_HOST.test(host) || host.endsWith(".gov.cn") || host.includes(".gov.")) return true
  return GOV_TEXT.test(`${title} ${snippet} ${host}`)
}

export function isCustomerProspect(url: string, title = "", snippet = "", targets: string[] = []) {
  if (isGovernmentSource(url, title, snippet)) return false
  const host = hostOf(url)
  const root = registrableDomain(host)
  if (host && (JUNK_RESULT_HOST.has(host) || JUNK_RESULT_HOST.has(root) || /\.edu(\.[a-z]{2})?$|\.ac\.cn$/i.test(host))) return false
  const blob = `${title} ${snippet} ${url}`
  if (BUYER_HINT.test(blob)) return true
  const focus = targets.map((item) => searchFocus(item)).filter(Boolean).join(" ")
  if (!focus || !COMPANY_HINT.test(blob)) return false
  return focus.split(/\s+/).some((word) => word.length >= 2 && blob.toLowerCase().includes(word.toLowerCase()))
}

export function searchFocus(label: string) {
  return label
    .replace(/[\/｜|、,，]/g, " ")
    .replace(/厂家|厂商|公司|有限/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function emailMatchesSite(email: string, pageUrl: string) {
  const emailHost = email.trim().toLowerCase().split("@")[1] || ""
  const pageHost = hostOf(pageUrl).replace(/^www\./, "")
  if (!emailHost || !pageHost) return false
  const mailRoot = registrableDomain(emailHost)
  const pageRoot = registrableDomain(pageHost)
  return mailRoot === pageRoot || pageHost.endsWith(`.${mailRoot}`) || emailHost.endsWith(`.${pageRoot}`)
}

export function isKeptCustomerFinding(item: InquiryFinding) {
  const email = item.contact?.trim().toLowerCase() || ""
  if (!email || isStaffTestEmail(email) || !isPublicBusinessEmail(email)) return false
  if (item.source === "同事测试指令") return false
  if (item.source === "同事补充指令" || item.source === "同事对话") return true
  if (item.source?.startsWith("http") && !emailMatchesSite(email, item.source)) return false
  return isCustomerProspect(item.source || "", item.org, `${item.pain || ""} ${item.place || ""}`)
}

export function retireUnfitFindings(state: InquiryState) {
  let changed = false
  const findings = state.findings.map((item) => {
    if (item.outreach !== "draft" && item.outreach !== "queued") return item
    if (isStaffTestEmail(item.contact || "") || isKeptCustomerFinding(item)) return item
    changed = true
    return { ...item, outreach: "blocked" as const }
  })
  return { state: changed ? { ...state, findings } : state, changed }
}

export function isInquiryStatusQuestion(message: string) {
  const text = message.replace(/\s+/g, " ").trim()
  if (!text) return false
  return /发(邮件|信)了吗|发出[去了]吗|有没有发|找到了吗|写好了吗|起草了吗|发出去了吗|询单(怎么样|如何|进度|怎样)|任务(怎么样|如何|怎样)|做了吗|开始了吗|邮件(发了|发出|怎么样|如何)/.test(
    text,
  )
}

export function inquiryWorkSummary(inquiry: InquiryState) {
  const all = inquiry.findings.filter((item) => item.contact?.trim())
  const factory = all.filter((item) => isKeptCustomerFinding(item))
  const tests = all.filter((item) => isStaffTestEmail(item.contact || ""))
  const blocked = all.filter((item) => item.outreach === "blocked")
  const sent = factory.filter((item) => item.outreach === "sent")
  const drafted = factory.filter((item) => item.outreach === "draft" || item.outreach === "queued")
  const task = currentInquiryTask(inquiry) || pickRunnableInquiryTask(inquiry)
  const runnable = Boolean(task && (task.targets.length || task.instruction.trim()) && task.status !== "cancelled")
  const blockedLine = blocked.length ? `已排除 ${blocked.length} 个不像客户的旧对象，不会再发给他们。` : ""
  if (!factory.length) {
    if (runnable) {
      return {
        reply: [tests.length
          ? `同事那 ${tests.length} 封是发给自己的测试信（${tests.map((item) => item.contact).join("、")}），不是厂商对象。`
          : "", blockedLine].filter(Boolean).join("\n"),
        shouldRun: true,
        shouldFlush: false,
      }
    }
    return {
      reply: tests.length
        ? `同事那封是测试信。还没有厂商询单任务。先定厂家类型或说开始，我自己去找公开邮箱并发给对方，不用指定收件人。`
        : blockedLine || "还没开始找，也还没有起草或发出的信。把厂家类型定好，或者说一声开始，我现在就跑。",
      shouldRun: false,
      shouldFlush: false,
    }
  }
  const lines = [
    sent.length
      ? `已经发给厂商 ${sent.length} 封，都有邮局回执：${sent.map((item) => item.contact).join("、")}。`
      : "还没有一封带着邮局回执、发给厂商的信。",
    drafted.length
      ? `已经起草给厂商 ${drafted.length} 封：${drafted.map((item) => item.contact).join("、")}。发出信箱已配置的话我会直接发给这些厂商，不用同事指定收件人。`
      : "",
    tests.length ? `另有发给同事的测试信 ${tests.length} 封，不算厂商询单。` : "",
    blockedLine,
    sent.length ? "" : "没有邮局回执就不会写成已发送。",
  ]
  return { reply: lines.filter(Boolean).join("\n"), shouldRun: false, shouldFlush: drafted.length > 0 }
}

export function parseCoachInquirySpec(message: string) {
  const targets = NEED_PRESETS.filter((item) => message.includes(item.label)).map((item) => item.label)
  const quota = message.match(/最多找\s*(\d+)\s*家/)
  const hours = message.match(/限时\s*(\d+)\s*小时/)
  return {
    targets,
    quota: quota ? asQuota(Number(quota[1])) : undefined,
    limitHours: hours ? Math.min(168, Math.max(1, Number(hours[1]))) : undefined,
  }
}

export async function runInquiryCoachCommand(input: {
  message: string
  inquiry: InquiryState
  env?: Record<string, string | undefined>
  now?: string
  fetchImpl?: FetchLike
}): Promise<InquiryRoundResult | null> {
  const kind = classifyInquiryCoachCommand(input.message)
  if (!kind) return null
  const now = input.now || new Date().toISOString()
  const env = input.env || {}
  const fetchImpl = input.fetchImpl || fetch
  if (kind === "report") {
    const journal = formatWorkJournal(input.inquiry.journal || [], 12)
    const last = input.inquiry.lastReport?.trim()
    const head = /发给了谁|发出名单/.test(input.message)
      ? buildOutreachRoster(input.inquiry)
      : buildOutreachDigest(input.inquiry, /周报|近 ?7|本周/.test(input.message) ? "week" : "day", new Date(now)).text
    const report = [head, last ? `上一轮工作：\n${last}` : "", `操作日志：\n${journal}`].filter(Boolean).join("\n\n")
    const sent = input.inquiry.findings.filter((item) => item.outreach === "sent" && item.receipt).length
    const drafted = input.inquiry.findings.filter((item) => item.outreach === "draft" || item.outreach === "queued").length
    return {
      inquiry: input.inquiry,
      findings: [],
      report,
      searched: 0,
      pages: 0,
      drafted,
      sent,
      queued: 0,
      nextAction: sent ? "已有发出记录，可继续找下一批" : "还没有发出回执，继续找客户并尝试发出",
    }
  }
  const directed = extractDirectedEmails(input.message)
  const testEmails = directed.filter((item) => isStaffTestEmail(item))
  const factoryEmails = directed.filter((item) => !isStaffTestEmail(item))
  const mailbox = resolveMailbox(env)

  if (kind === "send" && testEmails.length && !factoryEmails.length) {
    return runTestSend({
      inquiry: input.inquiry,
      emails: testEmails,
      env,
      now,
      fetchImpl,
    })
  }

  if (kind === "status" || (kind === "send" && !factoryEmails.length)) {
    const unsent = factoryUnsent(input.inquiry)
    if (unsent.length && mailbox.kind !== "none") {
      return flushUnsentFactoryMail({
        inquiry: input.inquiry,
        env,
        now,
        fetchImpl,
      })
    }
    if (kind === "status") {
      const summary = inquiryWorkSummary(input.inquiry)
      if (!summary.shouldRun) return statusSnapshot(input.inquiry, summary)
    }
  }

  const runKind: InquiryCoachKind = kind === "status" ? "search" : kind
  const spec = parseCoachInquirySpec(input.message)
  const extra = instructionForSearch(input.message, spec)
  let state = input.inquiry
  let task = pickRunnableInquiryTask(state)
  if (!task) {
    const created = createInquiryTask(
      state,
      {
        name: "对话询单",
        instruction: extra || "找肥料、土壤改良和农业合作社的公开邮箱",
        targets: spec.targets,
        quota: spec.quota || 8,
        limitHours: spec.limitHours,
        start: true,
      },
      now,
    )
    if (created.error || !created.task) return null
    state = created.state
    task = created.task
  } else {
    const nextInstruction = extra
      ? [stripStaffTestAddresses(task.instruction), extra].filter(Boolean).join("\n").slice(0, 2000)
      : stripStaffTestAddresses(task.instruction)
    const updated = updateInquiryTask(
      state,
      {
        id: task.id,
        instruction: nextInstruction,
        targets: spec.targets.length ? spec.targets : task.targets.map((item) => item.label),
        quota: spec.quota || task.quota,
        limitHours: spec.limitHours ?? task.limitHours ?? 0,
      },
      now,
    )
    const started = startInquiryTask(updated.state, task.id, now)
    if (started.error || !started.task) return null
    state = started.state
    task = started.task
  }
  return runInquiryRound({
    inquiry: state,
    task,
    env,
    now,
    fetchImpl,
    skipSearch: runKind === "send" && factoryEmails.length > 0,
    seedEmails: factoryEmails,
    seedSource: "同事补充指令",
  })
}

export function shouldRerunInquiry(message: string) {
  return /再找|再搜|继续询|再跑|再寻|再发一轮|再开始/.test(message)
}

function isBareMailCommand(text: string) {
  const compact = text.replace(/\s+/g, "")
  if (isInquiryStatusQuestion(text)) return true
  return /^(请)?(帮我)?(去)?发(个|一封)?(邮件|信)(吧|啊)?[!！。？?]*$/.test(compact)
    || /^(把信|把邮件|把推广信)发出(去)?[!！。？?]*$/.test(compact)
}

function instructionForSearch(message: string, spec: { targets: string[] }) {
  const stripped = stripStaffTestAddresses(message)
  if (isBareMailCommand(message)) return ""
  if (spec.targets.length || /厂家|厂商|合作社|肥料|土壤|农业|询单/.test(stripped)) return stripped
  if (/发(邮件|信)|发给|去发/.test(message)) return "找肥料、土壤改良和农业合作社的公开邮箱"
  return stripped
}

function factoryUnsent(inquiry: InquiryState) {
  return inquiry.findings.filter((item) => {
    if (item.outreach !== "draft" && item.outreach !== "queued") return false
    return isKeptCustomerFinding(item)
  })
}

function factoryCounts(inquiry: InquiryState) {
  const factory = inquiry.findings.filter((item) => item.contact?.trim() && !isStaffTestEmail(item.contact || ""))
  return {
    drafted: factory.filter((item) => item.outreach === "draft" || item.outreach === "queued").length,
    sent: factory.filter((item) => item.outreach === "sent").length,
    queued: factory.filter((item) => item.outreach === "queued").length,
  }
}

function statusSnapshot(inquiry: InquiryState, summary: ReturnType<typeof inquiryWorkSummary>): InquiryRoundResult {
  const counts = factoryCounts(inquiry)
  return {
    inquiry,
    findings: [],
    report: summary.reply,
    searched: 0,
    pages: 0,
    drafted: counts.drafted,
    sent: counts.sent,
    queued: counts.queued,
    nextAction: summary.reply.includes("还没开始") ? "先定条件再开始" : "按已有结果继续",
  }
}

function mailFromFinding(finding: InquiryFinding, siteUrl: string): OutreachMail | null {
  const email = finding.contact?.trim()
  if (!email) return null
  const composed = composeOutreachMail({ org: finding.org, email, pain: finding.pain, siteUrl })
  if (!finding.draft) return composed
  const parts = finding.draft.split("\n\n")
  return {
    to: email,
    subject: parts[0]?.trim() || composed.subject,
    text: parts.slice(1).join("\n\n").trim() || composed.text,
  }
}

async function runTestSend(input: {
  inquiry: InquiryState
  emails: string[]
  env: Record<string, string | undefined>
  now: string
  fetchImpl: FetchLike
}) {
  let state = input.inquiry
  let task = pickRunnableInquiryTask(state)
  if (!task) {
    const created = createInquiryTask(
      state,
      {
        name: "发出测试",
        instruction: "同事要求做一次发出测试",
        quota: Math.max(1, input.emails.length),
        start: true,
      },
      input.now,
    )
    if (created.error || !created.task) return null
    state = created.state
    task = created.task
  } else {
    const started = startInquiryTask(state, task.id, input.now)
    if (started.error || !started.task) return null
    state = started.state
    task = started.task
  }
  return runInquiryRound({
    inquiry: state,
    task,
    env: input.env,
    now: input.now,
    fetchImpl: input.fetchImpl,
    skipSearch: true,
    seedEmails: input.emails,
    seedSource: "同事测试指令",
    seedOnly: true,
  })
}

export async function flushUnsentFactoryMail(input: {
  inquiry: InquiryState
  env?: Record<string, string | undefined>
  now?: string
  fetchImpl?: FetchLike
  siteUrl?: string
}): Promise<InquiryRoundResult> {
  const now = input.now || new Date().toISOString()
  const env = input.env || {}
  const fetchImpl = input.fetchImpl || fetch
  const siteUrl = input.siteUrl || resolveSiteUrl(env)
  const mailbox = resolveMailbox(env)
  const workbench = resolveWorkbench(env)
  const task = currentInquiryTask(input.inquiry) || pickRunnableInquiryTask(input.inquiry)
  const retired = retireUnfitFindings(input.inquiry)
  const unsent = factoryUnsent(retired.state)
  const fresh: InquiryFinding[] = []
  for (const finding of unsent) {
    const mail = mailFromFinding(finding, siteUrl)
    if (!mail) continue
    let outreach: InquiryFinding["outreach"] = finding.outreach
    let receipt = finding.receipt
    if (mailbox.kind !== "none" || workbench.kind === "remote") {
      const sent = await sendOutreachMail(mailbox, mail, fetchImpl, workbench).catch(() => ({
        ok: false as const,
        error: "send-failed",
      }))
      if (sent.ok) {
        outreach = "sent"
        receipt = sent.receipt
      } else {
        outreach = "draft"
      }
    }
    fresh.push({
      ...finding,
      at: now,
      outreach,
      receipt,
      draft: finding.draft || `${mail.subject}\n\n${mail.text}`,
    })
  }
  const findings = applyInquiryFindings(retired.state.findings, fresh, now)
  const sent = fresh.filter((item) => item.outreach === "sent").length
  const drafted = fresh.filter((item) => item.outreach === "draft" || item.outreach === "queued").length
  const queued = fresh.filter((item) => item.outreach === "queued").length
  const report = buildFlushReport({ findings: fresh, mailbox })
  const job = { status: "drafting" as const, brief: report.split("\n")[0] || "发给已找到的厂商", updatedAt: now }
  const tasks = task
    ? input.inquiry.tasks.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: "drafting" as const,
              brief: job.brief,
              updatedAt: now,
              lastRunAt: now,
              runs: [
                ...item.runs,
                { id: newInquiryId("run"), at: now, status: "done" as const, note: report.replace(/\n/g, " ").slice(0, 200) },
              ].slice(-20),
            }
          : item,
      )
    : input.inquiry.tasks
  return {
    inquiry: { ...retired.state, findings, job, tasks, currentId: task?.id || input.inquiry.currentId },
    findings: fresh,
    report,
    searched: 0,
    pages: 0,
    drafted,
    sent,
    queued,
    nextAction: sent ? "已发给找到的厂商，等回邮" : drafted ? "厂商推广信已起草，待发出" : "继续找公开邮箱",
  }
}

function buildFlushReport(input: { findings: InquiryFinding[]; mailbox: OutreachMailbox }) {
  const contacts = input.findings.map((item) => item.contact?.trim()).filter((item): item is string => Boolean(item))
  const sent = input.findings.filter((item) => item.outreach === "sent").length
  const drafted = input.findings.filter((item) => item.outreach === "draft" || item.outreach === "queued").length
  const lines = ["本轮把已起草的推广信发给找到的厂商，没有问同事要收件人。"]
  if (contacts.length) lines.push(`对象是 ${contacts.join("、")}。`)
  if (sent) lines.push(`已通过${mailboxLabel(input.mailbox)}发出 ${sent} 封，每封都留下了邮局回执。`)
  if (drafted && input.mailbox.kind === "none") {
    lines.push("本站环境没读到发出信箱密钥，信仍是草稿，没有写成已发送。")
  } else if (drafted && input.mailbox.kind === "hermes" && !sent) {
    lines.push("WEHO 发出信箱已配置，这一下没有邮局回执，信仍是草稿，没有写成已发送。")
  } else if (drafted && !sent) {
    lines.push("发出信箱这一下没有回执，信仍是草稿，没有写成已发送。")
  }
  return lines.join("\n")
}

export function pickRunnableInquiryTask(state: InquiryState) {
  const current = currentInquiryTask(state)
  if (current && current.status !== "cancelled" && (current.targets.length || current.instruction.trim())) {
    return current
  }
  return state.tasks.find(
    (item) =>
      (item.status === "searching" || item.status === "review" || item.status === "drafting" || item.status === "idle") &&
      (item.targets.length || item.instruction.trim()),
  )
}

export type InquiryChannel = { id: string; label: string; query: string }

export function planSearchChannels(task: InquiryTask): InquiryChannel[] {
  const focuses = unique(task.targets.map((item) => searchFocus(item.label)).filter(Boolean))
  const topic = focuses[0] || "肥料 土壤改良"
  const channels: InquiryChannel[] = [
    { id: "factory", label: "生产厂家", query: `${topic} 有限公司 销售部 邮箱` },
    { id: "dealer", label: "经销与采购企业", query: `${topic} 经销商 采购 联系邮箱` },
    { id: "coop", label: "合作社与基地", query: `${topic} 合作社 基地 联系邮箱` },
  ]
  const second = focuses.find((item) => item !== topic)
  if (second) channels.push({ id: "buyer", label: "相关企业", query: `${second} 企业 采购 邮箱` })
  return channels.slice(0, 4)
}

export function buildSearchQueries(task: InquiryTask) {
  return planSearchChannels(task).map((item) => item.query)
}

export type CustomerJudgment = {
  fit: "high" | "mid" | "low"
  need: string
  plan: string
  role: string
}

export function judgeCustomerNeed(text: string, targets: string[] = []): CustomerJudgment {
  const blob = text.replace(/\s+/g, " ")
  const pains: string[] = []
  if (/板结|酸化|盐碱|土壤改良|土壤/.test(blob) || targets.some((item) => /土壤|板结/.test(item))) pains.push("土壤改良")
  if (/化肥|肥料|肥效|成本/.test(blob) || targets.some((item) => /肥/.test(item))) pains.push("肥料基料")
  if (/有机|茶叶|茶园|水稻|稻|种植/.test(blob) || targets.some((item) => /茶|稻|种植|有机/.test(item))) pains.push("种植端用量")
  const interested = /采购|经销|招商|合作|供应|销售|联系|基地|合作社|厂家|工厂/.test(blob)
  const fit: CustomerJudgment["fit"] = pains.length && interested ? "high" : pains.length || interested ? "mid" : "low"
  const need = pains[0] || (targets[0] ? searchFocus(targets[0]) : "") || "土壤改良或肥料合作"
  const role = /合作社/.test(blob) ? "合作社" : /经销|贸易|批发/.test(blob) ? "经销企业" : /基地|茶场|农场/.test(blob) ? "种植基地" : /厂|制造|生产/.test(blob) ? "生产厂家" : "企业"
  const plan =
    fit === "low"
      ? ""
      : need.includes("土壤")
        ? "可落实：先按作物和面积寄小样，对照板结或酸碱情况。检测数字只随正式报告，不在信里编。"
        : need.includes("肥料")
          ? "可落实：先要现有配方和大致吨位，再寄样品。掺混比例等对方工艺确认，不预写检测结果。"
          : "可落实：先确认作物、地区和吨位，再寄样品和项目说明。不编检测数字。"
  return { fit, need, plan, role }
}

export function inferContactPerson(text: string, email: string) {
  const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
  const at = plain.toLowerCase().indexOf(email.toLowerCase())
  const slice = at >= 0 ? plain.slice(Math.max(0, at - 90), at + email.length + 40) : plain.slice(0, 500)
  const named = slice.match(/(?:销售经理|采购经理|理事长|总经理)\s*[:：]?\s*([\u4e00-\u9fff]{2,4})/)
  const person = named?.[1] || ""
  if (!person || /公司|合作社|经理|我们|联系|销售|采购/.test(person)) return ""
  return person
}

function isWellFormedEmail(value: string) {
  const email = value.trim().toLowerCase()
  const at = email.lastIndexOf("@")
  if (at < 1 || email.length > 190) return false
  const local = email.slice(0, at)
  const host = email.slice(at + 1)
  if (!local || !host.includes(".") || host.startsWith(".") || host.endsWith(".")) return false
  if (BLOCKED_LOCAL.test(local) || PLACEHOLDER_LOCAL.test(local) || HASH_LOCAL.test(local)) return false
  if (/\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/i.test(host)) return false
  if (TRACKER_HOST.test(host)) return false
  const parts = host.split(".")
  const root = parts.slice(-2).join(".")
  if (BLOCKED_HOST.has(host) || BLOCKED_HOST.has(root)) return false
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,24}$/.test(email)
}

function isConsumerMailHost(host: string) {
  const root = host.split(".").slice(-2).join(".")
  return CONSUMER_MAIL_HOST.has(host) || CONSUMER_MAIL_HOST.has(root)
}

export function isStaffTestEmail(value: string) {
  const email = value.trim().toLowerCase()
  const host = email.split("@")[1] || ""
  return isWellFormedEmail(email) && isConsumerMailHost(host)
}

function isSendableEmail(value: string, source?: string) {
  if (isPublicBusinessEmail(value)) return true
  return source === "同事测试指令" && isStaffTestEmail(value)
}

export function isPublicBusinessEmail(value: string) {
  if (!isWellFormedEmail(value)) return false
  const host = value.trim().toLowerCase().split("@")[1] || ""
  return !isConsumerMailHost(host)
}

export function extractPublicEmails(text: string) {
  const found = new Set<string>()
  for (const match of text.matchAll(MAILTO_RE)) {
    const email = match[1]?.trim().toLowerCase()
    if (email && isPublicBusinessEmail(email)) found.add(email)
  }
  for (const match of text.matchAll(EMAIL_RE)) {
    const email = match[0]?.trim().toLowerCase()
    if (email && isPublicBusinessEmail(email)) found.add(email)
  }
  return [...found]
}

export function extractDirectedEmails(text: string) {
  const found = new Set<string>()
  for (const match of text.matchAll(MAILTO_RE)) {
    const email = match[1]?.trim().toLowerCase()
    if (email && isWellFormedEmail(email)) found.add(email)
  }
  for (const match of text.matchAll(EMAIL_RE)) {
    const email = match[0]?.trim().toLowerCase()
    if (email && isWellFormedEmail(email)) found.add(email)
  }
  return [...found]
}

export function stripStaffTestAddresses(text: string) {
  return text
    .replace(EMAIL_RE, (match) => (isStaffTestEmail(match) ? "" : match))
    .replace(/[（(]\s*[）)]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function decodeSearchTarget(value: string) {
  const raw = decodeEntities(value).trim()
  if (/^https?:\/\//i.test(raw)) return raw
  const packed = raw.startsWith("a1") ? raw.slice(2) : raw
  const padded = packed.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (packed.length % 4)) % 4)
  try {
    const decoded = decodeURIComponent(
      Array.from(atob(padded), (ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
    )
    if (/^https?:\/\//i.test(decoded) || decoded.startsWith("/")) return decoded
  } catch {
    /* not base64 */
  }
  return raw.startsWith("http") ? raw : ""
}

export function unwrapSearchUrl(href: string) {
  try {
    const url = new URL(decodeEntities(href), "https://www.bing.com")
    const packed = url.searchParams.get("uddg") || url.searchParams.get("u")
    if (packed) {
      const inner = decodeSearchTarget(packed)
      if (inner && inner !== href) return unwrapSearchUrl(inner)
    }
    if (
      isSearchHost(url.hostname) ||
      JUNK_RESULT_HOST.has(url.hostname) ||
      JUNK_RESULT_HOST.has(url.hostname.split(".").slice(-2).join(".")) ||
      url.hostname.endsWith(".myshopify.com") ||
      isGovernmentSource(url.href)
    ) {
      return ""
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""
    return url.href
  } catch {
    return ""
  }
}

export function harvestTaskSeeds(task: InquiryTask) {
  const blob = [task.instruction, ...task.targets.map((item) => item.label)].join("\n")
  const emails = extractPublicEmails(blob)
  const urls = [...blob.matchAll(/https?:\/\/[^\s<>"'）)]+/g)]
    .map((match) => unwrapSearchUrl(match[0] || ""))
    .filter(Boolean)
  return { emails, urls: unique(urls) }
}

export function parseSearchHtml(html: string) {
  const hits: SearchHit[] = []
  const seen = new Set<string>()
  const push = (href: string, title: string, snippet = "") => {
    const url = unwrapSearchUrl(decodeEntities(href))
    if (!url || seen.has(url)) return
    seen.add(url)
    hits.push({
      title: stripTags(title).slice(0, 160),
      url,
      snippet: stripTags(snippet).slice(0, 240),
    })
  }
  const block = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  for (const match of html.matchAll(block)) push(match[1] || "", match[2] || "")
  const generic = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  for (const match of html.matchAll(generic)) {
    if (hits.length >= 16) break
    push(match[1] || "", match[2] || "")
  }
  const packed = /[?&]u=([^&"]+)/gi
  for (const match of html.matchAll(packed)) {
    if (hits.length >= 16) break
    push(decodeEntities(`https://www.bing.com/ck/a?u=${match[1] || ""}`), "")
  }
  return hits.slice(0, 16)
}

export function parseSearchJson(raw: unknown) {
  if (!raw || typeof raw !== "object") return []
  const row = raw as Record<string, unknown>
  const web = row.web && typeof row.web === "object" ? (row.web as Record<string, unknown>).results : undefined
  const lists = [row.results, row.organic_results, web, row.data]
  const hits: SearchHit[] = []
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (!item || typeof item !== "object") continue
      const rec = item as Record<string, unknown>
      const url = unwrapSearchUrl(String(rec.url || rec.link || rec.href || ""))
      if (!url) continue
      hits.push({
        title: String(rec.title || rec.name || "").slice(0, 160),
        url,
        snippet: String(rec.snippet || rec.description || rec.body || rec.content || "").slice(0, 240),
      })
    }
  }
  return uniqueBy(hits, (item) => item.url).slice(0, 16)
}

export function inferOrgName(title: string, url: string, snippet = "") {
  const host = hostOf(url).replace(/^www\./, "")
  const cut = title.replace(/\s*[|\-–—·].*$/, "").replace(/\s+/g, " ").trim()
  if (/[\u4e00-\u9fff]/.test(cut) && cut.length >= 2 && cut.length <= 40) return cut
  if (cut && cut.length <= 48 && !/^(home|welcome|contact|about|index)$/i.test(cut)) return cut
  const fromSnippet = snippet.match(/([\u4e00-\u9fff]{2,20}(?:有限公司|合作社|集团|厂家|公司|基地))/)
  if (fromSnippet?.[1]) return fromSnippet[1]
  return host || "公开来源"
}

export function composeOutreachMail(input: {
  org: string
  email: string
  pain?: string
  plan?: string
  person?: string
  siteUrl?: string
}): OutreachMail {
  const site = (input.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, "")
  const who = input.person || (input.org && input.org !== "公开来源" ? input.org : "贵司")
  const need = input.pain?.trim()
  const plan =
    input.plan?.trim() ||
    "可落实的下一步是回信说明作物、地区和大致吨位，我们按这个寄样品和项目说明。检测数字只随正式报告，不在这封信里编。"
  const text = [
    `尊敬的${who}：`,
    "",
    `我们是${OUTREACH_BRIEF.projectName}。核心产品是${OUTREACH_BRIEF.productName}，${OUTREACH_BRIEF.pitch}`,
    need ? `从公开页面看，贵司和「${need}」有关。` : "如贵司在做肥料、土壤改良、合作社供货或种植基地采购，",
    plan,
    `产品与项目说明：${site}`,
    "",
    "此致",
    OUTREACH_BRIEF.projectName,
  ].join("\n")
  return {
    to: input.email,
    subject: `${OUTREACH_BRIEF.productName}｜${(need || "土壤改良").slice(0, 12)}合作`,
    text,
  }
}

export function mailboxLabel(mailbox: OutreachMailbox) {
  if (mailbox.kind === "none") return "本站环境没读到发出信箱"
  if (mailbox.kind === "hermes") return "WEHO 已配置的发出信箱"
  if (mailbox.kind === "agentmail") return "本站询单信箱"
  if (mailbox.kind === "sendgrid") return "本站发出信箱"
  return "本站发信接口"
}

export async function sendOutreachMail(
  mailbox: OutreachMailbox,
  mail: OutreachMail,
  fetchImpl: FetchLike = fetch,
  workbench: ReturnType<typeof resolveWorkbench> = { kind: "local" },
) {
  if (workbench.kind === "remote") {
    const via = await sendViaWorkbench(workbench, mail, fetchImpl)
    if (via.ok) return via
  }
  if (mailbox.kind === "none") return { ok: false as const, error: "no-mailbox" }
  if (mailbox.kind === "hermes") return sendViaHermes(mailbox, mail, fetchImpl)
  if (mailbox.kind === "agentmail") {
    const response = await timedFetch(
      fetchImpl,
      `${mailbox.baseUrl}/v0/inboxes/${encodeURIComponent(mailbox.inboxId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mailbox.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
          ...(mailbox.from ? { replyTo: [mailbox.from] } : {}),
        }),
      },
      8000,
    )
    if (!response || response.status >= 300) return { ok: false as const, error: "send-failed" }
    const receipt = await readReceipt(response)
    return receipt ? { ok: true as const, receipt } : { ok: false as const, error: "no-receipt" }
  }
  if (mailbox.kind === "sendgrid") {
    const response = await timedFetch(
      fetchImpl,
      "https://api.sendgrid.com/v3/mail/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mailbox.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: mail.to }] }],
          from: { email: mailbox.from },
          subject: mail.subject,
          content: [{ type: "text/plain", value: mail.text }],
        }),
      },
      8000,
    )
    if (!response || (response.status !== 202 && response.status >= 300)) {
      return { ok: false as const, error: "send-failed" }
    }
    const receipt = response.headers.get("x-message-id") || (await readReceipt(response))
    return receipt ? { ok: true as const, receipt } : { ok: false as const, error: "no-receipt" }
  }
  const response = await timedFetch(
    fetchImpl,
    mailbox.url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(mailbox.token ? { Authorization: `Bearer ${mailbox.token}` } : {}),
      },
      body: JSON.stringify({
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        from: mailbox.from || "",
      }),
    },
    8000,
  )
  if (!response || response.status >= 300) return { ok: false as const, error: "send-failed" }
  const receipt = await readReceipt(response)
  return receipt ? { ok: true as const, receipt } : { ok: false as const, error: "no-receipt" }
}

async function sendViaHermes(
  mailbox: Extract<OutreachMailbox, { kind: "hermes" }>,
  mail: OutreachMail,
  fetchImpl: FetchLike,
) {
  const root = mailbox.baseUrl.replace(/\/v1\/?$/, "")
  const payload = {
    to: `email:${mail.to}`,
    subject: mail.subject,
    message: mail.text,
    text: mail.text,
    platform: "email",
  }
  const urls = unique([`${root}/v1/send`, `${root}/send`])
  for (const url of urls) {
    const response = await timedFetch(
      fetchImpl,
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mailbox.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      2000,
    )
    if (!response || response.status >= 300) continue
    const receipt = await readReceipt(response)
    if (receipt) return { ok: true as const, receipt }
  }
  return { ok: false as const, error: "send-failed" }
}

async function sendViaWorkbench(
  workbench: Extract<ReturnType<typeof resolveWorkbench>, { kind: "remote" }>,
  mail: OutreachMail,
  fetchImpl: FetchLike,
) {
  const response = await timedFetch(
    fetchImpl,
    `${workbench.url}/send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(workbench.token ? { Authorization: `Bearer ${workbench.token}` } : {}),
      },
      body: JSON.stringify({ to: mail.to, subject: mail.subject, text: mail.text }),
    },
    8000,
  )
  if (!response || response.status >= 300) return { ok: false as const, error: "send-failed" }
  const receipt = await readReceipt(response)
  return receipt ? { ok: true as const, receipt } : { ok: false as const, error: "no-receipt" }
}

export async function runInquiryRound(input: {
  inquiry: InquiryState
  task: InquiryTask
  env?: Record<string, string | undefined>
  fetchImpl?: FetchLike
  now?: string
  siteUrl?: string
  budgetMs?: number
  skipSearch?: boolean
  seedEmails?: string[]
  seedSource?: string
  seedOnly?: boolean
}): Promise<InquiryRoundResult> {
  const now = input.now || new Date().toISOString()
  const env = input.env || {}
  const fetchImpl = input.fetchImpl || fetch
  const siteUrl = input.siteUrl || resolveSiteUrl(env)
  const mailbox = resolveMailbox(env)
  const quota = Math.min(12, Math.max(1, input.task.quota || 8))
  const retired = retireUnfitFindings(input.inquiry)
  const base = retired.state
  const known = new Set(
    base.findings
      .map((item) => item.contact?.trim().toLowerCase())
      .filter((item): item is string => Boolean(item)),
  )
  const deadline = Date.now() + (input.budgetMs ?? 18_000)
  const seeds = input.seedOnly
    ? { emails: unique(input.seedEmails || []), urls: [] as string[] }
    : harvestTaskSeeds(input.task)
  if (!input.seedOnly && input.seedEmails?.length) seeds.emails = unique([...input.seedEmails, ...seeds.emails])
  const pain = input.task.targets.map((item) => item.label).join("、")
  const fresh: InquiryFinding[] = []
  const seedSource = input.seedSource || "同事补充指令"
  const workbench = resolveWorkbench(env)
  const logs: InquiryWorkEvent[] = []
  const log = (kind: InquiryWorkEvent["kind"], text: string, extra: Partial<InquiryWorkEvent> = {}) => {
    logs.push({ id: newInquiryId("log"), at: now, kind, text, taskId: input.task.id, ...extra })
  }
  log(
    "think",
    `${describeWorkbench(mailbox.kind === "none" && workbench.kind === "local" ? "none" : workbench.kind)} 本轮分渠道找生产厂家、经销采购企业和合作社。政府官网不联系。先判断需求和可落实做法，再真实起草、发出。`,
  )
  if (retired.changed) log("skip", `排除 ${retired.state.findings.filter((item) => item.outreach === "blocked").length} 个不像客户的旧对象，不再发给他们。`)

  const addFinding = async (
    org: string,
    email: string,
    source: string,
    place?: string,
    judged?: CustomerJudgment,
    person?: string,
  ) => {
    if (!isSendableEmail(email, source)) return
    if (source.startsWith("http") && !emailMatchesSite(email, source)) {
      log("skip", `邮箱和页面不是同一家，丢掉 ${email}`, { url: source, contact: email })
      return
    }
    if (source !== "同事测试指令" && source !== "同事补充指令" && !isCustomerProspect(source, org, "", input.task.targets.map((item) => item.label))) {
      log("skip", `跳过不像客户的来源 ${org} ${email}`, { url: source, contact: email })
      return
    }
    if (judged?.fit === "low") {
      log("skip", `${org} 看不出采购或生产意向，先不联系`, { url: source, contact: email })
      return
    }
    const prior =
      fresh.find((item) => item.contact?.trim().toLowerCase() === email) ||
      base.findings.find((item) => item.contact?.trim().toLowerCase() === email)
    if (prior?.outreach === "sent" && prior.receipt) return
    if (known.has(email) && !input.skipSearch) return
    if (fresh.length >= quota && !prior) return
    known.add(email)
    const need = judged?.need || pain
    const mail = composeOutreachMail({
      org: prior?.org && prior.org !== "公开来源" ? prior.org : org,
      email,
      pain: need,
      plan: judged?.plan,
      person,
      siteUrl,
    })
    let outreach: InquiryFinding["outreach"] = mailbox.kind === "none" ? "draft" : "queued"
    let receipt: string | undefined
    log("found", `记下${judged?.role || "客户"} ${org}${person ? `（${person}）` : ""} ${email}`, { url: source, contact: email })
    log("think", `${org}：需求「${need || "待核对"}」。${judged?.plan || "按公开页面起草，不编检测数字。"}`)
    log("draft", `已按判断起草给 ${email}`, { contact: email })
    if ((mailbox.kind !== "none" || workbench.kind === "remote") && fresh.filter((item) => item.outreach === "sent").length < 3 && Date.now() < deadline) {
      log("send", `正在通过${workbench.kind === "remote" ? "询单工作台" : mailboxLabel(mailbox)}发给 ${email}`, { contact: email })
      const sent = await sendOutreachMail(mailbox, mail, fetchImpl, workbench).catch(() => ({ ok: false as const, error: "send-failed" }))
      if (sent.ok) {
        outreach = "sent"
        receipt = sent.receipt
        log("sent", `已发出给 ${email}，回执 ${sent.receipt}`, { contact: email })
      } else {
        outreach = "draft"
        log("fail", `发给 ${email} 这一下没有邮局回执，仍是草稿`, { contact: email })
      }
    }
    const row: InquiryFinding = {
      id: prior?.id || newInquiryId("find"),
      at: now,
      org: prior?.org && prior.org !== "公开来源" ? prior.org : org,
      place: prior?.place || place,
      pain: prior?.pain || need || pain || undefined,
      source: prior?.source || source,
      contact: email,
      outreach,
      draft: prior?.draft || `${mail.subject}\n\n${mail.text}`,
      receipt,
      caseId: prior?.caseId,
    }
    const index = fresh.findIndex((item) => item.id === row.id || item.contact === email)
    if (index >= 0) fresh[index] = row
    else fresh.push(row)
  }

  for (const email of seeds.emails) {
    await addFinding(inferOrgName("", `https://${email.split("@")[1] || "source"}`), email, seedSource, email.split("@")[1])
  }

  const channels = input.skipSearch ? [] : planSearchChannels(input.task)
  const hits: SearchHit[] = seeds.urls.map((url) => ({ title: "", url, snippet: "" }))
  let searched = 0
  const labels = input.task.targets.map((item) => item.label)

  if (channels.length && Date.now() < deadline) {
    const batches = await Promise.all(
      channels.map(async (channel) => {
        log("search", `渠道「${channel.label}」：${channel.query}`)
        const batch = await searchPublicWeb(channel.query, env, fetchImpl, Math.min(4000, Math.max(800, deadline - Date.now())), workbench)
        return batch.map((hit) => ({ ...hit, channel: channel.label }))
      }),
    )
    searched = channels.length
    for (const hit of batches.flat()) {
      if (isGovernmentSource(hit.url, hit.title, hit.snippet) || !isCustomerProspect(hit.url, hit.title, hit.snippet, labels)) {
        log("skip", `跳过不像 B 端客户的页面 ${hit.title || hostOf(hit.url)}`, { url: hit.url })
        continue
      }
      if (!hits.some((row) => row.url === hit.url)) hits.push(hit)
    }
  }

  const pages: { hit: SearchHit; html: string }[] = []
  const targets = input.skipSearch
    ? []
    : hits
        .filter((hit) => isCustomerProspect(hit.url, hit.title, hit.snippet, labels))
        .sort((a, b) => prospectRank(b) - prospectRank(a))
        .slice(0, 6)
  for (const group of chunk(targets, 3)) {
    if (Date.now() >= deadline || fresh.length >= quota) break
    const rows = await Promise.all(
      group.map(async (hit) => {
        log("open", `打开${hit.channel ? `「${hit.channel}」` : "客户"}页 ${hit.title || hostOf(hit.url)}`, { url: hit.url })
        return {
          hit,
          html: await fetchText(fetchImpl, hit.url, Math.min(3500, Math.max(600, deadline - Date.now()))),
        }
      }),
    )
    pages.push(...rows.filter((row) => row.html))
  }

  for (const page of pages) {
    if (fresh.length >= quota) break
    const title = page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || page.hit.title
    if (isGovernmentSource(page.hit.url, title, page.hit.snippet) || !isCustomerProspect(page.hit.url, title, page.hit.snippet, labels)) {
      log("skip", `打开后确认不是客户页，已丢掉 ${stripTags(title).slice(0, 40)}`, { url: page.hit.url })
      continue
    }
    const emails = extractPublicEmails(`${page.html}\n${page.hit.title}`).filter((email) => emailMatchesSite(email, page.hit.url))
    if (!emails.length) {
      log("skip", `页面上没有和本公司同域的公开邮箱 ${hostOf(page.hit.url)}`, { url: page.hit.url })
      continue
    }
    const plain = `${decodeEntities(stripTags(title))} ${page.hit.snippet} ${stripTags(page.html).slice(0, 1800)}`
    const judged = judgeCustomerNeed(plain, labels)
    const org = inferOrgName(decodeEntities(stripTags(title)), page.hit.url, page.hit.snippet)
    if (judged.fit === "low") {
      log("skip", `${org} 看不出采购或生产意向，先不联系`, { url: page.hit.url })
      continue
    }
    for (const email of emails.slice(0, 2)) {
      const person = inferContactPerson(page.html, email)
      await addFinding(org, email, page.hit.url, hostOf(page.hit.url).replace(/^www\./, "") || undefined, judged, person)
    }
  }

  const sent = fresh.filter((item) => item.outreach === "sent").length
  const drafted = fresh.filter((item) => item.outreach === "draft" || item.outreach === "queued").length
  const queued = fresh.filter((item) => item.outreach === "queued").length
  const jobStatus = nextJobStatus(fresh, pages.length)
  const report = [
    describeWorkbench(mailbox.kind === "none" && workbench.kind === "local" ? "none" : workbench.kind),
    buildRoundReport({
      task: input.task,
      queries: searched,
      pages: pages.length,
      findings: fresh,
      mailbox,
      hits: hits.length,
      skipped: logs.filter((item) => item.kind === "skip").length,
    }),
  ].join("\n")
  const job = { status: jobStatus, brief: report.split("\n").filter((line) => !line.startsWith("本轮在") && !line.startsWith("本轮接") && !line.startsWith("本轮没有"))[0] || input.task.brief, updatedAt: now }
  const findings = applyInquiryFindings(base.findings, fresh, now)
  const tasks = base.tasks.map((item) =>
    item.id === input.task.id
      ? {
          ...item,
          status: jobStatus,
          brief: job.brief,
          updatedAt: now,
          lastRunAt: now,
          runs: [
            ...item.runs,
            { id: newInquiryId("run"), at: now, status: "done" as const, note: report.replace(/\n/g, " ").slice(0, 200) },
          ].slice(-20),
        }
      : item,
  )
  const inquiry: InquiryState = appendInquiryJournal(
    {
      ...base,
      findings,
      job,
      tasks,
      currentId: input.task.id,
      lastReport: report,
    },
    logs,
    now,
  )
  return {
    inquiry,
    findings: fresh,
    report,
    searched,
    pages: pages.length,
    drafted,
    sent,
    queued,
    nextAction: sent ? "已发出推广信，等回邮" : drafted ? "推广信已起草，待发出" : "继续找公开邮箱",
  }
}

export function inquiryStartStaffMessage(task: InquiryTask) {
  return buildTaskAssignMessage(task)
}

function nextJobStatus(findings: InquiryFinding[], pageCount: number): InquiryJobStatus {
  if (findings.some((item) => item.draft)) return "drafting"
  if (pageCount > 0) return "review"
  return "searching"
}

function buildRoundReport(input: {
  task: InquiryTask
  queries: number
  pages: number
  hits: number
  findings: InquiryFinding[]
  mailbox: OutreachMailbox
  skipped?: number
}) {
  const want = input.task.targets.map((item) => item.label).join("、") || input.task.instruction.slice(0, 40) || "已定的厂家类型"
  const contacts = input.findings.map((item) => item.contact?.trim()).filter((item): item is string => Boolean(item))
  const emails = contacts.length
  const sent = input.findings.filter((item) => item.outreach === "sent").length
  const drafted = input.findings.filter((item) => item.outreach === "draft" || item.outreach === "queued").length
  const testOnly = emails > 0 && input.findings.every((item) => isStaffTestEmail(item.contact || "") || item.source === "同事测试指令")
  const lines = testOnly
    ? [`这是同事要求的发出测试，收件人是同事自己的邮箱，不是厂商。正式询单信发给网上找到的厂商公开邮箱，不会问同事要收件人。`]
    : input.queries
      ? [`本轮按「${want}」分渠道找生产厂家、经销采购企业和合作社，查了 ${input.queries} 组搜索、打开 ${input.pages} 个客户页${input.skipped ? `，跳过 ${input.skipped} 个政府或无意向页面` : ""}。政府官网不联系。只对看得出需求的对象写可落实的推广信。`]
      : [`本轮按已找到的厂商公开邮箱起草并尝试发出，没有再问同事要收件人。`]
  if (testOnly) {
    lines.push(`测试对象：${contacts.join("、")}。已按本站${OUTREACH_BRIEF.productName}和官网起草 ${drafted + sent} 封。`)
  } else if (emails) {
    lines.push(
      `找到 ${emails} 个客户公开邮箱：${contacts.join("、")}。已按对方页面上的需求起草推广信 ${drafted + sent} 封，并写了可落实的下一步。`,
    )
  } else if (input.pages || input.hits) {
    lines.push("打开的页面上没有可收录的客户邮箱。政府官网和零售站已跳过。没有编造厂商或邮箱。")
  } else if (input.queries) {
    lines.push("搜索没有返回可打开的客户页。没有编造厂商或邮箱。同事可再点开始，我会继续自己找。")
  } else {
    lines.push("还没有可发的厂商公开邮箱。我会自己去网上找客户，不用同事指定收件人。")
  }
  if (sent) lines.push(`已通过${mailboxLabel(input.mailbox)}发出 ${sent} 封，每封都留下了邮局回执。`)
  if (drafted && input.mailbox.kind === "none") {
    lines.push("本站环境没读到发出信箱密钥，信已入队为草稿，没有写成已发送。")
  } else if (drafted && input.mailbox.kind === "hermes" && !sent) {
    lines.push("WEHO 发出信箱已配置，这一下没有邮局回执，信仍是草稿，没有写成已发送。")
  } else if (drafted && !sent) {
    lines.push("发出信箱这一下没有回执，信仍是草稿，没有写成已发送。")
  }
  const remain = Math.max(0, (input.task.quota || 8) - emails)
  if (emails && remain > 0) lines.push(`对照上限还差 ${remain} 家带公开邮箱的对象。`)
  return lines.join("\n")
}

async function searchPublicWeb(
  query: string,
  env: Record<string, string | undefined>,
  fetchImpl: FetchLike,
  budgetMs: number,
  workbench: ReturnType<typeof resolveWorkbench> = { kind: "local" },
) {
  if (workbench.kind === "remote") {
    const response = await timedFetch(
      fetchImpl,
      `${workbench.url}/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(workbench.token ? { Authorization: `Bearer ${workbench.token}` } : {}),
        },
        body: JSON.stringify({ q: query, query, max_results: 8 }),
      },
      Math.min(5000, budgetMs),
    )
    if (response && response.ok) {
      try {
        const hits = parseSearchJson(await response.json())
        if (hits.length) return hits
      } catch {
        /* fall through to public search */
      }
    }
  }

  const custom = pick(env, "INQUIRY_SEARCH_ENDPOINT")
  if (custom) {
    const url = new URL(custom)
    url.searchParams.set("q", query)
    const key = pick(env, "INQUIRY_SEARCH_KEY")
    const text = await fetchText(fetchImpl, url.toString(), Math.min(5000, budgetMs), {
      Accept: "application/json, text/html;q=0.8",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    })
    if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
      try {
        return parseSearchJson(JSON.parse(text))
      } catch {
        /* fall through */
      }
    }
    if (text) return parseSearchHtml(text)
  }

  const brave = pick(env, "BRAVE_SEARCH_API_KEY")
  if (brave) {
    const text = await fetchText(
      fetchImpl,
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
      Math.min(5000, budgetMs),
      { Accept: "application/json", "X-Subscription-Token": brave },
    )
    if (text) {
      try {
        const hits = parseSearchJson(JSON.parse(text))
        if (hits.length) return hits
      } catch {
        /* fall through */
      }
    }
  }

  const tavily = pick(env, "TAVILY_API_KEY")
  if (tavily) {
    const response = await timedFetch(
      fetchImpl,
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: tavily, query, max_results: 8, search_depth: "basic" }),
      },
      Math.min(5000, budgetMs),
    )
    if (response && response.ok) {
      try {
        const hits = parseSearchJson(await response.json())
        if (hits.length) return hits
      } catch {
        /* fall through */
      }
    }
  }

  const encoded = encodeURIComponent(query)
  const bing = await fetchText(
    fetchImpl,
    `https://www.bing.com/search?q=${encoded}&setlang=zh-cn`,
    Math.min(2500, budgetMs),
    { Accept: "text/html", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5" },
  )
  const fromBing = bing ? parseSearchHtml(bing) : []
  if (fromBing.length) return fromBing
  const ddg = await fetchText(fetchImpl, `https://html.duckduckgo.com/html/?q=${encoded}`, Math.min(2500, budgetMs), {
    Accept: "text/html",
  })
  return ddg ? parseSearchHtml(ddg) : []
}

async function fetchText(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
  headers: Record<string, string> = {},
) {
  const response = await timedFetch(
    fetchImpl,
    url,
    {
      headers: {
        "User-Agent": SEARCH_UA,
        Accept: headers.Accept || "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        ...headers,
      },
      redirect: "follow",
    },
    timeoutMs,
  )
  if (!response || !response.ok) return ""
  return (await response.text()).slice(0, 400_000)
}

async function timedFetch(fetchImpl: FetchLike, url: string, init: RequestInit, timeoutMs: number) {
  const control = new AbortController()
  const timer = setTimeout(() => control.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: control.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function readReceipt(response: Response) {
  const header = response.headers.get("x-message-id") || response.headers.get("x-request-id")
  if (header?.trim()) return header.trim().slice(0, 180)
  const text = await response.text().catch(() => "")
  if (!text) return ""
  try {
    const raw = JSON.parse(text) as Record<string, unknown>
    const id = raw.id || raw.message_id || raw.messageId || raw.request_id
    if (typeof id === "string" && id.trim()) return id.trim().slice(0, 180)
  } catch {
    /* plain text */
  }
  return ""
}

function pick(env: Record<string, string | undefined>, ...keys: string[]) {
  for (const key of keys) {
    const value = env[key]?.trim()
    if (value) return value
  }
  return ""
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ""
  }
}

function registrableDomain(host: string) {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean)
  if (parts.length <= 2) return parts.join(".")
  const tail = parts.slice(-2).join(".")
  if (/^(com|net|org|gov|edu|co)\.(cn|ph|uk|au|hk|tw|sg|jp|kr)$/.test(tail)) return parts.slice(-3).join(".")
  return tail
}

function prospectRank(hit: SearchHit) {
  const blob = `${hit.url} ${hit.title} ${hit.snippet}`
  let score = 0
  if (/联系|contact|邮箱|sales|销售|采购/.test(blob)) score += 4
  if (BUYER_HINT.test(blob)) score += 3
  if (/新闻|招聘|百科|政府|门户/.test(blob)) score -= 6
  return score
}

function isSearchHost(host: string) {
  return /duckduckgo|bing\.com|google\.|yahoo\.|baidu\.|microsoft\.com/i.test(host)
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function uniqueBy<T>(values: T[], key: (item: T) => string) {
  const seen = new Set<string>()
  return values.filter((item) => {
    const id = key(item)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function chunk<T>(values: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size))
  return out
}
