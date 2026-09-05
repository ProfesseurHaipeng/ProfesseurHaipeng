import { Buffer } from "node:buffer"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite"

type LocalLead = {
  id: string
  source?: string
  contact?: string
  email?: string
  name?: string
  org?: string
  note?: string
  at?: string
}

type LocalDeskFile = {
  cases: { id: string; gone?: boolean }[]
  coach: unknown[]
  events: unknown[]
  memory: { shared: string; desk: string; updatedAt: string }
  health: { status: "connected" | "disconnected"; checkedAt: string; model?: string; detail?: string } | null
  inquiry: {
    targets: unknown[]
    findings: unknown[]
    job: { status: string; brief: string; updatedAt: string }
    tasks?: unknown[]
    currentId?: string
  }
  ledger: { goneIds: string[]; goneLeadIds: string[]; goneVisitorIds: string[]; goneContacts: string[]; updatedAt: string }
  sessions: Record<string, unknown>
  ipVisitors: Record<string, { visitorId: string; at: string }>
  leads: LocalLead[]
}

function emptyLocalDeskFile(): LocalDeskFile {
  return {
    cases: [],
    coach: [],
    events: [],
    memory: { shared: "", desk: "", updatedAt: "" },
    health: null,
    inquiry: { targets: [], findings: [], job: { status: "idle", brief: "", updatedAt: "" }, tasks: [] },
    ledger: { goneIds: [], goneLeadIds: [], goneVisitorIds: [], goneContacts: [], updatedAt: "" },
    sessions: {},
    ipVisitors: {},
    leads: [],
  }
}

function loadLocalHermesDesk(file: string): LocalDeskFile {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<LocalDeskFile>
    const base = emptyLocalDeskFile()
    const health = raw.health
    return {
      cases: Array.isArray(raw.cases) ? raw.cases.filter((item) => item && typeof item.id === "string") : [],
      coach: Array.isArray(raw.coach) ? raw.coach : [],
      events: Array.isArray(raw.events) ? raw.events : [],
      memory: {
        shared: typeof raw.memory?.shared === "string" ? raw.memory.shared : "",
        desk: typeof raw.memory?.desk === "string" ? raw.memory.desk : "",
        updatedAt: typeof raw.memory?.updatedAt === "string" ? raw.memory.updatedAt : "",
      },
      health:
        health && (health.status === "connected" || health.status === "disconnected")
          ? {
              status: health.status,
              checkedAt: typeof health.checkedAt === "string" ? health.checkedAt : "",
              model: health.model,
              detail: health.detail,
            }
          : null,
      inquiry: raw.inquiry && typeof raw.inquiry === "object" ? { ...base.inquiry, ...raw.inquiry } : base.inquiry,
      ledger: raw.ledger && typeof raw.ledger === "object" ? { ...base.ledger, ...raw.ledger } : base.ledger,
      sessions: raw.sessions && typeof raw.sessions === "object" ? raw.sessions : {},
      ipVisitors: raw.ipVisitors && typeof raw.ipVisitors === "object" ? raw.ipVisitors : {},
      leads: Array.isArray(raw.leads) ? raw.leads.filter((item) => item && typeof item.id === "string") : [],
    }
  } catch {
    return emptyLocalDeskFile()
  }
}

function saveLocalHermesDesk(file: string, state: LocalDeskFile) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(state, null, 2))
}

function localConversationId(seed: string, secret: string) {
  const clean = (seed || "anon").trim().slice(0, 120) || "anon"
  if (!secret.trim()) return `linda:${clean}`
  let a = 2166136261
  let b = 2246822519
  const material = `linda:${clean}:${secret}`
  for (let i = 0; i < material.length; i += 1) {
    const code = material.charCodeAt(i)
    a ^= code
    a = Math.imul(a, 16777619)
    b = Math.imul(b ^ code, 3266489917) >>> 0
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

function localGuide(): Plugin {
  const attach = (server: ViteDevServer) => {
    const loaded = loadEnv(server.config.mode, server.config.envDir || process.cwd(), "")
    const env: Record<string, string | undefined> = {
      ...process.env,
      ...loaded,
      SIGNED_GUIDE_FALLBACK: loaded.SIGNED_GUIDE_FALLBACK || process.env.SIGNED_GUIDE_FALLBACK || "1",
    }
    const deskFile = join(server.config.root || process.cwd(), ".netlify", "local-hermes-desk.json")
    const persisted = loadLocalHermesDesk(deskFile)
    const localLeads: LocalLead[] = persisted.leads.slice()
    const localDesk = {
      cases: persisted.cases.slice(),
      coach: persisted.coach.slice(),
      events: persisted.events.slice(),
      memory: persisted.memory,
      health: persisted.health,
      images: {} as Record<string, { mime: string; name: string; data: string }>,
      inquiry: persisted.inquiry,
      ledger: persisted.ledger,
      sessions: { ...persisted.sessions },
      ipVisitors: { ...persisted.ipVisitors },
    }
    const persistDesk = () => {
      saveLocalHermesDesk(deskFile, {
        cases: localDesk.cases,
        coach: localDesk.coach,
        events: localDesk.events,
        memory: localDesk.memory,
        health: localDesk.health,
        inquiry: localDesk.inquiry,
        ledger: localDesk.ledger,
        sessions: localDesk.sessions,
        ipVisitors: localDesk.ipVisitors,
        leads: localLeads,
      })
    }
    const staffOk = (req: IncomingMessage) => {
      const user = env.ADMIN_USER || "admin"
      const pass = env.ADMIN_PASSWORD || "ash-draft"
      return req.headers["x-admin-user"] === user && req.headers["x-admin-pass"] === pass
    }
    server.middlewares.use("/api/leads", (req: IncomingMessage, res: ServerResponse) => {
      void (async () => {
        res.setHeader("Content-Type", "application/json")
        if (req.method === "POST") {
          try {
            const raw = await readBody(req)
            const leadsMod = await server.ssrLoadModule("/src/cms/leads.ts")
            const input = leadsMod.sanitizeLead(raw ? JSON.parse(raw) : null)
            if (!input) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: "invalid" }))
              return
            }
            localLeads.unshift({ ...input, id: leadsMod.newLeadId(), at: new Date().toISOString() })
            persistDesk()
            res.end(JSON.stringify({ ok: true }))
          } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ error: "bad-json" }))
          }
          return
        }
        if (!staffOk(req)) {
          res.statusCode = 401
          res.end(JSON.stringify({ error: "unauthorized" }))
          return
        }
        if (req.method === "GET") {
          res.end(JSON.stringify({ leads: localLeads }))
          return
        }
        if (req.method === "DELETE") {
          const url = new URL(req.url || "/", "http://local")
          const id = url.searchParams.get("id") || ""
          if (!id.startsWith("lead-")) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: "bad-id" }))
            return
          }
          const index = localLeads.findIndex((item) => item.id === id)
          if (index >= 0) localLeads.splice(index, 1)
          persistDesk()
          res.end(JSON.stringify({ ok: true }))
          return
        }
        res.statusCode = 405
        res.end(JSON.stringify({ error: "method" }))
      })()
    })
    server.middlewares.use("/api/hermes-desk", (req: IncomingMessage, res: ServerResponse) => {
      void (async () => {
        res.setHeader("Content-Type", "application/json")
        if (req.method === "OPTIONS") {
          res.end(JSON.stringify({ ok: true }))
          return
        }
        if (!staffOk(req)) {
          res.statusCode = 401
          res.end(JSON.stringify({ error: "unauthorized" }))
          return
        }
        const deskMod = await server.ssrLoadModule("/src/cms/hermesDesk.ts")
        const hermesMod = await server.ssrLoadModule("/src/cms/hermes.ts")
        const inquiryMod = await server.ssrLoadModule("/src/cms/inquiryDesk.ts")
        const outreachMod = await server.ssrLoadModule("/src/cms/inquiryOutreach.ts")
        const boardCases = () => {
          const swept = deskMod.sweepBoardNoise(localDesk.cases)
          if (swept.changed) {
            localDesk.cases = swept.cases
            for (const item of swept.gone) localDesk.ledger = deskMod.markGoneOnLedger(localDesk.ledger, item)
            persistDesk()
          }
          return deskMod.liveCases(localDesk.cases, localDesk.ledger)
        }
        const pack = () => {
          const cases = boardCases()
          try {
            persistDesk()
          } catch {
            /* keep serving the in-memory board if the local file is locked */
          }
          return deskMod.decorateDeskPayload({
            cases,
            coach: localDesk.coach,
            events: localDesk.events,
            memory: localDesk.memory,
            health: localDesk.health,
            link: hermesMod.hermesLinkInfo(env),
            hermesReady: hermesMod.hermesReady(env),
            attachable: deskMod.publicAttachable(deskMod.attachableLeads(cases, localLeads)),
            inquiry: localDesk.inquiry,
          })
        }
        const pushEvent = (kind: string, text: string, caseId?: string) => {
          localDesk.events = [
            ...localDesk.events,
            { id: deskMod.newEventId(), at: new Date().toISOString(), kind, text, caseId },
          ].slice(-80)
        }
        if (req.method === "GET") {
          const migrated = inquiryMod.migrateInquiryTasks(inquiryMod.hydrateInquiryState(localDesk.inquiry))
          const ticked = inquiryMod.tickInquiryTasks(migrated.state)
          localDesk.inquiry = ticked.state
          const url = new URL(req.url || "/", "http://local")
          const asset = url.searchParams.get("asset") || ""
          if (asset.startsWith("img-")) {
            const image = localDesk.images[asset]
            if (!image) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: "missing" }))
              return
            }
            res.setHeader("Content-Type", image.mime)
            res.end(Buffer.from(image.data, "base64"))
            return
          }
          res.end(JSON.stringify(pack()))
          return
        }
        if (req.method !== "POST") {
          res.statusCode = 405
          res.end(JSON.stringify({ error: "method" }))
          return
        }
        try {
          const raw = await readBody(req)
          const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
          const action = typeof body.action === "string" ? body.action : ""
          if (action && !deskMod.isStaffAction(action)) {
            res.statusCode = 403
            res.end(JSON.stringify({ error: "hermes-only" }))
            return
          }
          if (action === "health") {
            const probed = await hermesMod.probeHermes(env)
            const health = hermesMod.rememberHermesHealth(localDesk.health, probed)
            if (localDesk.health?.status !== health.status) {
              pushEvent("health", health.status === "connected" ? "网关探测：正常连接" : "网关探测：断开连接")
            }
            if (health.status === "connected" || localDesk.health?.status !== "connected") localDesk.health = health
            persistDesk()
            res.end(
              JSON.stringify({
                health: localDesk.health,
                hermesReady: hermesMod.hermesReady(env),
                link: hermesMod.hermesLinkInfo(env),
              }),
            )
            return
          }
          if (action === "targets") {
            const next = inquiryMod.applyTargetWrite(localDesk.inquiry.targets, body)
            if (next.error === "empty") {
              res.statusCode = 400
              res.end(JSON.stringify({ error: "empty" }))
              return
            }
            localDesk.inquiry = { ...localDesk.inquiry, targets: next.targets }
            pushEvent("update", "询单：更新要找的厂商弊端")
            res.end(JSON.stringify(pack()))
            return
          }
          if (action === "job") {
            const next = inquiryMod.applyStaffJob(localDesk.inquiry.job, localDesk.inquiry.targets, body.status)
            if (next.error === "empty") {
              res.statusCode = 400
              res.end(JSON.stringify({ error: "empty" }))
              return
            }
            if (next.error === "hermes-only") {
              res.statusCode = 403
              res.end(JSON.stringify({ error: "hermes-only" }))
              return
            }
            localDesk.inquiry = { ...localDesk.inquiry, job: next.job }
            pushEvent("update", `询单：${next.job.status}`)
            res.end(JSON.stringify(pack()))
            return
          }
          if (action === "file") {
            const findingId = typeof body.findingId === "string" ? body.findingId : ""
            const result = deskMod.fileFinding(localDesk.inquiry, localDesk.cases, findingId)
            if (result.error) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: result.error }))
              return
            }
            localDesk.inquiry = result.inquiry
            localDesk.cases = result.cases
            pushEvent("update", `询单：建档 ${result.case?.org || ""}`.trim(), result.case?.id)
            res.end(JSON.stringify(pack()))
            return
          }
          if (action === "attach") {
            const leadId = typeof body.leadId === "string" ? body.leadId : ""
            const result = deskMod.attachLead(localDesk.cases, localLeads, leadId, undefined, localDesk.ledger)
            if (result.error === "missing") {
              res.statusCode = 400
              res.end(JSON.stringify({ error: "missing" }))
              return
            }
            localDesk.cases = result.cases
            localDesk.ledger = result.ledger
            pushEvent("update", `接入线索 ${result.case?.name || leadId}`, result.case?.id)
            res.end(JSON.stringify(pack()))
            return
          }
          if (action === "import") {
            const before = localDesk.cases.length
            localDesk.cases = deskMod.importLeads(localDesk.cases, localLeads, undefined, localDesk.ledger)
            pushEvent("update", `接入前台线索 ${Math.max(0, localDesk.cases.length - before)} 条`)
            res.end(JSON.stringify(pack()))
            return
          }
          if (action === "cases") {
            const op = typeof body.op === "string" ? body.op : ""
            if (op === "delete" || op === "clear") {
              const ids = Array.isArray(body.ids) ? body.ids.filter((item): item is string => typeof item === "string") : []
              const result = op === "clear" ? deskMod.applyStaffCasesClear(localDesk.cases) : deskMod.applyStaffCasesDelete(localDesk.cases, ids)
              if (result.error) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: result.error }))
                return
              }
              localDesk.cases = result.cases
              for (const item of result.gone || []) {
                localDesk.ledger = deskMod.markGoneOnLedger(localDesk.ledger, item)
              }
              try {
                persistDesk()
              } catch {
                res.statusCode = 503
                res.end(JSON.stringify({ error: "persist" }))
                return
              }
              pushEvent("update", `${op === "clear" ? "清空" : "删除"} ${result.count} 张工单`)
              res.end(JSON.stringify(pack()))
              return
            }
            if (op === "update") {
              const id = typeof body.id === "string" ? body.id : ""
              const patch = body.patch && typeof body.patch === "object" ? body.patch : body
              const result = deskMod.applyStaffCaseUpdate(localDesk.cases, id, patch as Record<string, unknown>)
              if (result.error === "empty") {
                res.statusCode = 400
                res.end(JSON.stringify({ error: "empty" }))
                return
              }
              if (result.error === "missing") {
                res.statusCode = 404
                res.end(JSON.stringify({ error: "missing" }))
                return
              }
              localDesk.cases = result.cases
              pushEvent("update", `编辑工单 ${result.case?.name || id}`, result.case?.id)
              res.end(JSON.stringify(pack()))
              return
            }
            if (op === "batch") {
              const ids = Array.isArray(body.ids) ? body.ids.filter((item): item is string => typeof item === "string") : []
              const patch = body.patch && typeof body.patch === "object" ? body.patch : {}
              const result = deskMod.applyStaffCasesBatch(localDesk.cases, ids, patch as Record<string, unknown>)
              if (result.error) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: result.error }))
                return
              }
              localDesk.cases = result.cases
              pushEvent("update", `批量编辑 ${result.count} 张工单`)
              res.end(JSON.stringify(pack()))
              return
            }
            res.statusCode = 400
            res.end(JSON.stringify({ error: "op" }))
            return
          }
          if (action === "task") {
            const now = new Date().toISOString()
            const inquiry = inquiryMod.hydrateInquiryState(localDesk.inquiry)
            const result = deskMod.applyInquiryTaskAction(inquiry, localDesk.cases, localDesk.ledger, body, now)
            if (result.error === "missing") {
              res.statusCode = 404
              res.end(JSON.stringify({ error: result.error }))
              return
            }
            if (result.error) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: result.error }))
              return
            }
            localDesk.inquiry = result.inquiry
            localDesk.cases = result.cases
            localDesk.ledger = result.ledger
            if (result.event) pushEvent("update", result.event, result.caseId)
            const op = typeof body.op === "string" ? body.op : ""
            const shouldRun = (op === "start" || (op === "create" && result.assignMessage)) && result.inquiry.currentId
            if (shouldRun) {
              const task = result.inquiry.tasks.find((item: { id: string }) => item.id === result.inquiry.currentId)
              if (task && task.status === "searching") {
                const run = await outreachMod.runInquiryRound({
                  inquiry: result.inquiry,
                  task,
                  env,
                  now,
                })
                localDesk.inquiry = run.inquiry
                localDesk.coach = [
                  ...localDesk.coach,
                  {
                    id: deskMod.newCoachTurnId(),
                    at: now,
                    role: "staff",
                    content: result.assignMessage || `开始询单：${task.name}`,
                  },
                  {
                    id: deskMod.newCoachTurnId(Date.now() + 1),
                    at: new Date().toISOString(),
                    role: "hermes",
                    content: run.report,
                  },
                ]
                if (result.caseId) {
                  localDesk.cases = localDesk.cases.map((item) =>
                    item.id === result.caseId
                      ? { ...item, nextAction: run.nextAction, updatedAt: now, following: true }
                      : item,
                  )
                }
                pushEvent("coach", String(run.report || "").replace(/\n/g, " ").slice(0, 180), result.caseId)
                res.end(
                  JSON.stringify({
                    ...pack(),
                    assignMessage: result.assignMessage || "",
                    caseId: result.caseId || "",
                    outreach: { searched: run.searched, drafted: run.drafted, sent: run.sent, report: run.report },
                  }),
                )
                return
              }
            }
            res.end(JSON.stringify({ ...pack(), assignMessage: result.assignMessage || "", caseId: result.caseId || "" }))
            return
          }
          if (action === "coach-clear") {
            localDesk.coach = []
            pushEvent("update", "清空工作台对话")
            res.end(JSON.stringify(pack()))
            return
          }
          if (action === "coach") {
            const now = new Date().toISOString()
            const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : ""
            const images = deskMod.sanitizeCoachImages(body.images)
            if (!message && !images.length) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: "empty" }))
              return
            }
            for (const image of images) localDesk.images[image.id] = { mime: image.mime, name: image.name, data: image.data }
            const staff = {
              id: deskMod.newCoachTurnId(),
              at: now,
              role: "staff",
              content: message || "（附图）",
              images: images.map((image: { id: string; mime: string; name: string }) => ({
                id: image.id,
                mime: image.mime,
                name: image.name,
              })),
            }
            const history = [...localDesk.coach, staff]
            const result = await deskMod.resolveCoachReply(
              localDesk.cases,
              history,
              env,
              localDesk.memory,
              images.map((image: { mime: string; data: string }) => ({ mime: image.mime, data: image.data })),
              localDesk.inquiry,
              localConversationId("desk:staff-inquiry", env.ADVISOR_CASE_ID_SECRET || ""),
            )
            const replyTurn = {
              id: deskMod.newCoachTurnId(Date.now() + 1),
              at: new Date().toISOString(),
              role: "hermes",
              content: result.reply,
            }
            localDesk.cases = result.cases
            if (result.memory) localDesk.memory = result.memory
            if (result.inquiry) localDesk.inquiry = result.inquiry
            localDesk.coach = [...history, replyTurn]
            pushEvent("coach", (message || "附图").slice(0, 180))
            res.end(
              JSON.stringify({
                ...pack(),
                coach: localDesk.coach,
                reply: result.reply,
                ...(result.outreach ? { outreach: result.outreach } : {}),
              }),
            )
            return
          }
          res.statusCode = 400
          res.end(JSON.stringify({ error: "action" }))
        } catch {
          res.statusCode = 400
          res.end(JSON.stringify({ error: "bad-json" }))
        }
      })()
    })
    server.middlewares.use("/api/guide", (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      void (async () => {
        if (req.method === "OPTIONS") {
          res.statusCode = 200
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ ok: true }))
          return
        }
        if (req.method !== "POST") {
          next()
          return
        }
        try {
          const knowledgeMod = await server.ssrLoadModule("/src/cms/knowledge.ts")
          const contentMod = await server.ssrLoadModule("/src/cms/defaultContent.ts")
          const runtimeMod = await server.ssrLoadModule("/src/cms/guideRuntime.ts")
          const greetingMod = await server.ssrLoadModule("/src/cms/greeting.ts")
          const hermesMod = await server.ssrLoadModule("/src/cms/hermes.ts")
          const raw = await readBody(req)
          const body = raw
            ? (JSON.parse(raw) as {
                messages?: { role?: string; content?: string }[]
                greet?: boolean
                escalate?: boolean
                advisor?: string
                hermes?: string
                visitorId?: string
                handoffIndex?: number | null
                takenOver?: boolean
              })
            : {}
          if (body.hermes === "status") {
            res.statusCode = 200
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ ready: hermesMod.hermesReady(env) }))
            return
          }
          const sessionMod = await server.ssrLoadModule("/src/cms/guideSession.ts")
          const persistLocalChat = (visitor: string, messages: unknown, reply: string, advisor: string, lang: string, extra?: { handoffIndex?: unknown; takenOver?: unknown }) => {
            if (!visitor) return
            const session = sessionMod.sessionAfterReply(messages, reply, {
              visitorId: visitor,
              advisor: advisor === "hermes" ? "hermes" : "lin",
              lang: lang === "en" ? "en" : "zh",
              handoffIndex: extra?.handoffIndex,
              takenOver: extra?.takenOver,
            })
            if (session) localDesk.sessions[visitor] = session
          }
          if (body.greet === true) {
            const visitorId = typeof body.visitorId === "string" ? body.visitorId.trim() : ""
            const stored = visitorId ? sessionMod.hydrateGuideSession(localDesk.sessions[visitorId], visitorId) : null
            if (stored) {
              res.statusCode = 200
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ reply: "", source: "resume", lang: stored.lang, hermesReady: hermesMod.hermesReady(env), resumed: true, visitorId: stored.visitorId, session: stored }))
              return
            }
            const accept = String(req.headers["accept-language"] || "")
            const lang = accept.toLowerCase().startsWith("zh") ? "zh" : accept ? "en" : "zh"
            const reply = lang === "en" ? greetingMod.buildGreetingEn(null) : greetingMod.buildGreeting(null)
            persistLocalChat(visitorId, [], reply, "lin", lang)
            res.statusCode = 200
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ reply, source: "greeting", lang, hermesReady: hermesMod.hermesReady(env), visitorId }))
            return
          }
          const messages = Array.isArray(body.messages) ? body.messages : []
          const escalate = body.escalate === true
          const visitorId = typeof body.visitorId === "string" ? body.visitorId.trim() : ""
          const advisor = body.advisor === "hermes" || escalate ? "hermes" : "lin"
          const deskMod = await server.ssrLoadModule("/src/cms/hermesDesk.ts")
          if (advisor === "hermes" && deskMod.isHumanOwned(localDesk.cases, visitorId)) {
            const lastUser = [...messages].reverse().find((item) => item.role === "user")
            const turnLang = greetingMod.replyLang("zh", lastUser?.content)
            res.statusCode = 200
            res.setHeader("Content-Type", "application/json")
            persistLocalChat(visitorId, messages, deskMod.humanTakenOverReply(turnLang), "hermes", turnLang, {
              takenOver: true,
            })
            res.end(
              JSON.stringify({
                reply: deskMod.humanTakenOverReply(turnLang),
                source: "local",
                advisor: "hermes",
                lang: turnLang,
                takenOver: true,
                hermesReady: hermesMod.hermesReady(env),
                visitorId,
              }),
            )
            return
          }
          if (!escalate && !messages.some((item) => item.role === "user")) {
            res.statusCode = 400
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ error: "empty" }))
            return
          }
          const lastUser = [...messages].reverse().find((item) => item.role === "user")
          const turnLang = greetingMod.replyLang("zh", lastUser?.content)
          const langHint =
            turnLang === "en"
              ? "The customer's latest message is in English. You MUST answer this turn in natural English."
              : "客户最后一条消息是中文。本轮必须全程用简体中文回答，不要夹英文段落。"
          let extra = escalate ? `${langHint}\n${hermesMod.hermesHandoffHint(turnLang)}` : langHint
          if (advisor === "hermes") {
            extra = deskMod.frontHermesExtra(
              localDesk.memory,
              deskMod.findHermesCase(localDesk.cases, { visitorId }),
              extra,
            )
          }
          const result = await runtimeMod.resolveGuideReply(
            messages,
            knowledgeMod.flattenKnowledge(contentMod.defaultContent),
            env,
            extra,
            {
              advisor,
              escalate,
              lang: turnLang,
              conversationId: localConversationId(visitorId || "anon-front", env.ADVISOR_CASE_ID_SECRET || ""),
            },
          )
          const suppressed = deskMod.isIdentitySuppressed(
            { visitorId: visitorId || undefined, contact: result.ticket?.contact },
            localDesk.ledger,
          )
          let ticketFiled = false
          if (result.ticket && !suppressed) {
            const leadsMod = await server.ssrLoadModule("/src/cms/leads.ts")
            localLeads.unshift({
              id: leadsMod.newLeadId(),
              at: new Date().toISOString(),
              name: result.ticket.name || "AI 对话客户",
              org: result.ticket.org,
              email: result.ticket.contact.includes("@") ? result.ticket.contact : "",
              contact: result.ticket.contact,
              note: result.ticket.note,
              source: "ai",
            })
            ticketFiled = true
          }
          if (result.advisor === "hermes" && !suppressed) {
            const seeded = visitorId
              ? deskMod.upsertFromVisit(
                  localDesk.cases,
                  visitorId,
                  lastUser?.content || result.ticket?.note || "",
                  undefined,
                  localDesk.ledger,
                )
              : { cases: localDesk.cases, case: null }
            const withTicket = result.ticket
              ? deskMod.upsertFromTicket(
                  seeded.cases,
                  result.ticket,
                  { visitorId: visitorId || undefined, following: true },
                  undefined,
                  localDesk.ledger,
                )
              : seeded
            localDesk.cases = withTicket.cases
            persistDesk()
          }
          persistLocalChat(visitorId, messages, result.reply, result.advisor, turnLang, {
            handoffIndex: body.handoffIndex,
            takenOver: body.takenOver,
          })
          persistDesk()
          res.statusCode = 200
          res.setHeader("Content-Type", "application/json")
          res.end(
            JSON.stringify({
              reply: result.reply,
              source: result.source,
              ticket: ticketFiled,
              lang: turnLang,
              advisor: result.advisor,
              hermesReady: hermesMod.hermesReady(env),
              reconnecting: result.reconnecting === true,
              visitorId,
            }),
          )
        } catch {
          res.statusCode = 500
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ reply: "本地导览暂时不可用。" }))
        }
      })()
    })
  }

  return {
    name: "local-guide",
    configureServer: attach,
  }
}

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), localGuide()],
  build: {
    outDir: process.env.VITE_HASH === "1" ? "../docs" : "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
})
