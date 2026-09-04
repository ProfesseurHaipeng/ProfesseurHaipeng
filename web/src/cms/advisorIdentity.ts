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

/** Stable per-visitor / per-desk identity. Never send the raw visitor id to the gateway. */
export function advisorConversationIdentity(seed: string, secret: string) {
  const clean = (seed || "anon").trim().slice(0, 120) || "anon"
  if (!secret.trim()) return `karmenai:${clean}`
  const material = `karmenai:${clean}:${secret}`
  return `${mix(material)}${mix(`rev:${[...material].reverse().join("")}`)}${mix(`v2:${material}`)}${mix(`v3:${material}`)}`
}
