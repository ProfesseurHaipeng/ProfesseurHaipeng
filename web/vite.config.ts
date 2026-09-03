import { Buffer } from "node:buffer"
import type { IncomingMessage, ServerResponse } from "node:http"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite"

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
    const env = {
      ...process.env,
      ...loadEnv(server.config.mode, server.config.envDir || process.cwd(), ""),
    }
    const localLeads: unknown[] = []
    const localDesk: { cases: { id: string }[]; coach: unknown[] } = { cases: [], coach: [] }
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
        if (req.method === "GET") {
          res.end(
            JSON.stringify({
              cases: deskMod.filterHermesCases(localDesk.cases),
              coach: localDesk.coach,
              hermesReady: hermesMod.hermesReady(env),
            }),
          )
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
          const now = new Date().toISOString()
          if (action === "sync") {
            localDesk.cases = deskMod.importLeads(localDesk.cases, localLeads, now)
            res.end(JSON.stringify({ cases: localDesk.cases, coach: localDesk.coach, hermesReady: hermesMod.hermesReady(env) }))
            return
          }
          const id = typeof body.id === "string" ? body.id : ""
          const current = localDesk.cases.find((item: { id?: string }) => item.id === id)
          if (action === "takeover" || action === "resume" || action === "update") {
            if (!current) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: "missing" }))
              return
            }
            const next =
              action === "takeover"
                ? deskMod.applyTakeover(current, now)
                : action === "resume"
                  ? deskMod.applyResume(current, now)
                  : deskMod.patchHermesCase(current, body, now)
            localDesk.cases = deskMod.sortHermesCases([next, ...localDesk.cases.filter((item: { id?: string }) => item.id !== next.id)])
            res.end(JSON.stringify({ cases: localDesk.cases, case: next, hermesReady: hermesMod.hermesReady(env) }))
            return
          }
          if (action === "coach") {
            const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : ""
            if (!message) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: "empty" }))
              return
            }
            const staff = { id: deskMod.newCoachTurnId(), at: now, role: "staff", content: message }
            const history = [...localDesk.coach, staff]
            const result = await deskMod.resolveCoachReply(localDesk.cases, history, env)
            const replyTurn = {
              id: deskMod.newCoachTurnId(Date.now() + 1),
              at: new Date().toISOString(),
              role: "hermes",
              content: result.reply,
            }
            localDesk.cases = result.cases
            localDesk.coach = [...history, replyTurn]
            res.end(
              JSON.stringify({
                cases: localDesk.cases,
                coach: localDesk.coach,
                reply: result.reply,
                hermesReady: hermesMod.hermesReady(env),
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
              })
            : {}
          if (body.hermes === "status") {
            res.statusCode = 200
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ ready: hermesMod.hermesReady(env) }))
            return
          }
          if (body.greet === true) {
            const accept = String(req.headers["accept-language"] || "")
            const lang = accept.toLowerCase().startsWith("zh") ? "zh" : accept ? "en" : "zh"
            const reply = lang === "en" ? greetingMod.buildGreetingEn(null) : greetingMod.buildGreeting(null)
            res.statusCode = 200
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ reply, source: "greeting", lang, hermesReady: hermesMod.hermesReady(env) }))
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
            res.end(
              JSON.stringify({
                reply: deskMod.humanTakenOverReply(turnLang),
                source: "local",
                advisor: "hermes",
                lang: turnLang,
                takenOver: true,
                hermesReady: hermesMod.hermesReady(env),
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
          const extra = escalate ? `${langHint}\n${hermesMod.hermesHandoffHint(turnLang)}` : langHint
          const result = await runtimeMod.resolveGuideReply(
            messages,
            knowledgeMod.flattenKnowledge(contentMod.defaultContent),
            env,
            extra,
            { advisor, escalate, lang: turnLang },
          )
          let ticketFiled = false
          if (result.ticket) {
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
          if (result.advisor === "hermes") {
            const seeded = visitorId
              ? deskMod.upsertFromVisit(localDesk.cases, visitorId, lastUser?.content || result.ticket?.note || "")
              : { cases: localDesk.cases, case: null }
            const withTicket = result.ticket
              ? deskMod.upsertFromTicket(seeded.cases, result.ticket, { visitorId: visitorId || undefined, following: true })
              : seeded
            localDesk.cases = withTicket.cases
          }
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
