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
          const raw = await readBody(req)
          const body = raw
            ? (JSON.parse(raw) as { messages?: { role?: string; content?: string }[]; greet?: boolean })
            : {}
          if (body.greet === true) {
            res.statusCode = 200
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ reply: greetingMod.buildGreeting(null), source: "greeting" }))
            return
          }
          const messages = Array.isArray(body.messages) ? body.messages : []
          const result = await runtimeMod.resolveGuideReply(
            messages,
            knowledgeMod.flattenKnowledge(contentMod.defaultContent),
            env,
          )
          res.statusCode = 200
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify(result))
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
