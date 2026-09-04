function mix(text: string) {
  let a = 2166136261
  let b = 2246822519
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    a ^= code
    a = Math.imul(a, 16777619)
    b = Math.imul(b ^ code, 3266489917) >>> 0
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0")
}

function asUuid(hex: string) {
  const h = `${hex}${"0".repeat(32)}`.slice(0, 32)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** Stable per-visitor / per-desk identity. Never send the raw visitor id to the gateway. */
export function advisorConversationIdentity(seed: string, secret: string) {
  const clean = (seed || "anon").trim().slice(0, 120) || "anon"
  if (!secret.trim()) return `karmenai:${clean}`
  const material = `karmenai:${clean}:${secret}`
  return asUuid(
    `${mix(material)}${mix(`rev:${[...material].reverse().join("")}`)}${mix(`v2:${material}`)}${mix(`v3:${material}`)}`,
  )
}
