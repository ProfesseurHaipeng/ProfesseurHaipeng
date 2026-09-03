import { existsSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const docs = join(dirname(fileURLToPath(import.meta.url)), "../../docs")

if (!existsSync(join(docs, "index.html"))) {
  throw new Error("docs/index.html is missing; run the Vite CDN build first")
}

writeFileSync(join(docs, ".nojekyll"), "")
