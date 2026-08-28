import { copyFileSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const dist = "dist"
const spaRoutes = ["project", "products", "use", "cases", "contact", "next", "admin"]

for (const route of spaRoutes) {
  mkdirSync(join(dist, route), { recursive: true })
  copyFileSync(join(dist, "index.html"), join(dist, route, "index.html"))
}

const redirects = {
  resource: "/project",
  supply: "/products",
  testing: "/products",
  market: "/use",
  solutions: "/use",
  videos: "/cases",
}

const bounce = (to) => `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${to}">
<title>Redirecting</title>
<script>location.replace(${JSON.stringify(to)})</script>
`

for (const [from, to] of Object.entries(redirects)) {
  mkdirSync(join(dist, from), { recursive: true })
  writeFileSync(join(dist, from, "index.html"), bounce(to))
}
