export function withBase(path: string) {
  if (!path) return path
  if (/^(https?:|data:|blob:|mailto:|tel:|#)/i.test(path)) return path
  const base = import.meta.env.BASE_URL || "/"
  return `${base}${path.replace(/^\/+/, "")}`
}

export function isHashBuild() {
  return import.meta.env.VITE_HASH === "1"
}

export function routerBasename() {
  if (isHashBuild()) return undefined
  const trimmed = (import.meta.env.BASE_URL || "/").replace(/\/$/, "")
  return trimmed && trimmed !== "." ? trimmed : undefined
}
