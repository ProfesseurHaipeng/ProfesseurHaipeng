import { completeChatCompletions } from "./chatCompletions"
import {
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
} from "./inquiryDesk"

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

export type InquiryCoachKind = "send" | "search"

export type SearchHit = {
  title: string
  url: string
  snippet: string
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
])

const BLOCKED_LOCAL = /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|webmaster|abuse|privacy|legal|newsletter|news|image|img|static|assets|webpack|sentry|wix)$/i
const PLACEHOLDER_LOCAL = /^(name|email|user|username|someone|foo|bar|sample|xxx|mailbox)$/i

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
  if (shouldRerunInquiry(text)) return "search"
  if (/开始询单|开始寻找|找公开邮箱|找厂商|找厂家|按这些真实需求|去网上找/.test(text)) return "search"
  if (NEED_PRESETS.some((item) => text.includes(item.label)) && /找|询单|厂家|厂商/.test(text)) return "search"
  return null
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
  const spec = parseCoachInquirySpec(input.message)
  let state = input.inquiry
  let task = pickRunnableInquiryTask(state)
  if (!task) {
    const created = createInquiryTask(
      state,
      {
        name: kind === "send" ? "定向发信" : "对话询单",
        instruction: input.message,
        targets: spec.targets,
        quota: spec.quota || (kind === "send" ? Math.max(1, extractDirectedEmails(input.message).length) : 8),
        limitHours: spec.limitHours,
        start: true,
      },
      now,
    )
    if (created.error || !created.task) return null
    state = created.state
    task = created.task
  } else {
    const updated = updateInquiryTask(
      state,
      {
        id: task.id,
        instruction: [task.instruction, input.message].filter(Boolean).join("\n").slice(0, 2000),
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
    env: input.env,
    now,
    fetchImpl: input.fetchImpl,
    skipSearch: kind === "send",
  })
}

export function shouldRerunInquiry(message: string) {
  return /再找|再搜|继续询|再跑|再寻|再发一轮|再开始/.test(message)
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

export function buildSearchQueries(task: InquiryTask) {
  const labels = task.targets.map((item) => item.label.trim()).filter(Boolean)
  const extra = task.instruction.replace(/\s+/g, " ").trim()
  const queries: string[] = []
  for (const label of labels) {
    queries.push(`${label} 联系邮箱`)
    queries.push(`${label} contact email`)
    queries.push(`${label} 厂家 邮箱`)
  }
  if (extra) {
    queries.push(`${extra} 邮箱`)
    queries.push(`${extra} contact email`)
  }
  if (!queries.length) {
    queries.push("土壤改良 肥料厂家 联系邮箱")
    queries.push("agricultural fertilizer manufacturer contact email")
  }
  return unique(queries).slice(0, 6)
}

function isSendableEmail(value: string, source?: string) {
  if (isPublicBusinessEmail(value)) return true
  if (source !== "同事补充指令" && source !== "同事对话") return false
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,24}$/.test(value.trim())
}

export function isPublicBusinessEmail(value: string) {
  const email = value.trim().toLowerCase()
  const at = email.lastIndexOf("@")
  if (at < 1 || email.length > 190) return false
  const local = email.slice(0, at)
  const host = email.slice(at + 1)
  if (!local || !host.includes(".") || host.startsWith(".") || host.endsWith(".")) return false
  if (BLOCKED_LOCAL.test(local) || PLACEHOLDER_LOCAL.test(local)) return false
  if (/\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/i.test(host)) return false
  const parts = host.split(".")
  const root = parts.slice(-2).join(".")
  if (BLOCKED_HOST.has(host) || BLOCKED_HOST.has(root)) return false
  return true
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
    if (email && isSendableEmail(email, "同事对话")) found.add(email)
  }
  for (const match of text.matchAll(EMAIL_RE)) {
    const email = match[0]?.trim().toLowerCase()
    if (email && isSendableEmail(email, "同事对话")) found.add(email)
  }
  return [...found]
}

function decodeSearchTarget(value: string) {
  const raw = decodeEntities(value).trim()
  if (/^https?:\/\//i.test(raw)) return raw
  const packed = raw.startsWith("a1") ? raw.slice(2) : raw
  const pad = "=".repeat((4 - (packed.length % 4)) % 4)
  try {
    const decoded = Buffer.from(packed.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
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
    if (isSearchHost(url.hostname) || JUNK_RESULT_HOST.has(url.hostname) || url.hostname.endsWith(".myshopify.com")) {
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
  const emails = extractDirectedEmails(blob)
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
  siteUrl?: string
}): OutreachMail {
  const site = (input.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, "")
  const who = input.org && input.org !== "公开来源" ? input.org : "贵司"
  const pain = input.pain?.trim()
  const need = pain ? `我们注意到贵司可能关注「${pain}」。` : "如你们在做土壤改良、肥料基料或生态农业，"
  const text = [
    `尊敬的${who}同事：`,
    "",
    `我们是${OUTREACH_BRIEF.projectName}。核心产品是${OUTREACH_BRIEF.productName}，${OUTREACH_BRIEF.pitch}`,
    `${need}欢迎查看产品与项目介绍：${site}`,
    "如需样品、检测报告或合作说明，直接回信告知作物、地区和大致吨位即可。",
    "",
    "此致",
    OUTREACH_BRIEF.projectName,
  ].join("\n")
  return {
    to: input.email,
    subject: `${OUTREACH_BRIEF.productName}｜土壤改良与生态农业合作`,
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
) {
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
  const urls = unique([`${mailbox.baseUrl}/send`, `${root}/v1/send`, `${root}/send`])
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
      2500,
    )
    if (!response || response.status >= 300) continue
    const receipt = await readReceipt(response)
    if (receipt) return { ok: true as const, receipt }
  }
  if (fetchImpl !== fetch) return { ok: false as const, error: "send-failed" }
  try {
    const reply = await completeChatCompletions(
      { apiKey: mailbox.apiKey, baseUrl: mailbox.baseUrl, model: mailbox.model },
      [
        {
          role: "system",
          content:
            "你是询单发信执行器。WEHO Hermes 的发出信箱已经配置好，不要说没挂信箱。立刻用这只信箱把下面这封信发出去。成功只回一行：SENT <邮局回执或message-id>。失败只回一行：FAILED <原因>。不要问收件人。",
        },
        {
          role: "user",
          content: `收件人：${mail.to}\n主题：${mail.subject}\n正文：\n${mail.text}`,
        },
      ],
      { hosts: "exact", timeoutMs: 16_000, lean: true },
    )
    const sent = reply?.match(/\bSENT\s+(\S+)/i)
    if (sent?.[1] && !/^failed|none|unknown$/i.test(sent[1])) {
      return { ok: true as const, receipt: sent[1].slice(0, 180) }
    }
  } catch {
    /* gateway chat send failed */
  }
  return { ok: false as const, error: "send-failed" }
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
}): Promise<InquiryRoundResult> {
  const now = input.now || new Date().toISOString()
  const env = input.env || {}
  const fetchImpl = input.fetchImpl || fetch
  const siteUrl = input.siteUrl || resolveSiteUrl(env)
  const mailbox = resolveMailbox(env)
  const quota = Math.min(12, Math.max(1, input.task.quota || 8))
  const known = new Set(
    input.inquiry.findings
      .map((item) => item.contact?.trim().toLowerCase())
      .filter((item): item is string => Boolean(item)),
  )
  const deadline = Date.now() + (input.budgetMs ?? 16_000)
  const seeds = harvestTaskSeeds(input.task)
  const pain = input.task.targets.map((item) => item.label).join("、")
  const fresh: InquiryFinding[] = []

  const addFinding = async (
    org: string,
    email: string,
    source: string,
    place?: string,
  ) => {
    if (fresh.length >= quota || known.has(email) || !isSendableEmail(email, source)) return
    known.add(email)
    const mail = composeOutreachMail({ org, email, pain, siteUrl })
    let outreach: InquiryFinding["outreach"] = mailbox.kind === "none" ? "draft" : "queued"
    let receipt: string | undefined
    if (mailbox.kind !== "none" && fresh.filter((item) => item.outreach === "sent").length < 3 && Date.now() < deadline) {
      const sent = await sendOutreachMail(mailbox, mail, fetchImpl).catch(() => ({ ok: false as const, error: "send-failed" }))
      if (sent.ok) {
        outreach = "sent"
        receipt = sent.receipt
      } else {
        outreach = "draft"
      }
    }
    fresh.push({
      id: newInquiryId("find"),
      at: now,
      org,
      place,
      pain: pain || undefined,
      source,
      contact: email,
      outreach,
      draft: `${mail.subject}\n\n${mail.text}`,
      receipt,
    })
  }

  for (const email of seeds.emails) {
    await addFinding(inferOrgName("", `https://${email.split("@")[1] || "source"}`), email, "同事补充指令", email.split("@")[1])
  }

  const queries = input.skipSearch ? [] : buildSearchQueries(input.task)
  const hits: SearchHit[] = seeds.urls.map((url) => ({ title: "", url, snippet: "" }))
  let searched = 0

  for (const query of queries) {
    if (Date.now() >= deadline || hits.length >= 14 || fresh.length >= quota) break
    const batch = await searchPublicWeb(query, env, fetchImpl, Math.max(800, deadline - Date.now()))
    searched += 1
    for (const hit of batch) {
      if (!hits.some((row) => row.url === hit.url)) hits.push(hit)
      for (const email of extractPublicEmails(`${hit.title} ${hit.snippet} ${hit.url}`)) {
        await addFinding(inferOrgName(hit.title, hit.url, hit.snippet), email, hit.url, hostOf(hit.url).replace(/^www\./, ""))
      }
    }
  }

  const pages: { hit: SearchHit; html: string }[] = []
  const targets = input.skipSearch ? [] : hits.slice(0, 8)
  for (const group of chunk(targets, 3)) {
    if (Date.now() >= deadline || fresh.length >= quota) break
    const rows = await Promise.all(
      group.map(async (hit) => ({
        hit,
        html: await fetchText(fetchImpl, hit.url, Math.min(4500, Math.max(600, deadline - Date.now()))),
      })),
    )
    pages.push(...rows.filter((row) => row.html))
  }

  for (const page of pages) {
    if (fresh.length >= quota) break
    const emails = extractPublicEmails(`${page.html}\n${page.hit.snippet}\n${page.hit.title}`)
    if (!emails.length) continue
    const title = page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || page.hit.title
    const org = inferOrgName(decodeEntities(stripTags(title)), page.hit.url, page.hit.snippet)
    for (const email of emails.slice(0, 2)) {
      await addFinding(org, email, page.hit.url, hostOf(page.hit.url).replace(/^www\./, "") || undefined)
    }
  }

  const sent = fresh.filter((item) => item.outreach === "sent").length
  const drafted = fresh.filter((item) => item.outreach === "draft" || item.outreach === "queued").length
  const queued = fresh.filter((item) => item.outreach === "queued").length
  const jobStatus = nextJobStatus(fresh, pages.length)
  const report = buildRoundReport({
    task: input.task,
    queries: searched,
    pages: pages.length,
    findings: fresh,
    mailbox,
    hits: hits.length,
  })
  const job = { status: jobStatus, brief: report.split("\n")[0] || input.task.brief, updatedAt: now }
  const findings = applyInquiryFindings(input.inquiry.findings, fresh, now)
  const tasks = input.inquiry.tasks.map((item) =>
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
  const inquiry: InquiryState = {
    ...input.inquiry,
    findings,
    job,
    tasks,
    currentId: input.task.id,
  }
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
}) {
  const want = input.task.targets.map((item) => item.label).join("、") || input.task.instruction.slice(0, 40) || "同事写下的条件"
  const contacts = input.findings.map((item) => item.contact?.trim()).filter((item): item is string => Boolean(item))
  const emails = contacts.length
  const sent = input.findings.filter((item) => item.outreach === "sent").length
  const drafted = input.findings.filter((item) => item.outreach === "draft" || item.outreach === "queued").length
  const lines = input.queries
    ? [`本轮按「${want}」在网上找对方已公布的邮箱，查了 ${input.queries} 组搜索、打开 ${input.pages} 个公开页面。`]
    : [`本轮按同事写下的邮箱起草推广信，没有再去网上搜。`]
  if (emails) {
    lines.push(
      `找到 ${emails} 个公开邮箱：${contacts.join("、")}。已按本站${OUTREACH_BRIEF.productName}和官网起草推广信 ${drafted + sent} 封。`,
    )
  } else if (input.pages || input.hits) {
    lines.push("打开的页面上没有可收录的公开邮箱。没有编造厂商或邮箱。")
  } else if (input.queries) {
    lines.push("搜索没有返回可打开的页面。没有编造厂商或邮箱。同事可再点开始，或把已知邮箱写在补充指令里。")
  } else {
    lines.push("同事这条指令里没有可发的公开邮箱。")
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
) {
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
    Math.min(4000, budgetMs),
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
