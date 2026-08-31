import { existsSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const site = join(dirname(fileURLToPath(import.meta.url)), "../../site")

if (!existsSync(join(site, "index.html"))) {
  throw new Error("site/index.html is missing; run the Vite CDN build first")
}

writeFileSync(join(site, ".nojekyll"), "")
