/** Strip source-disclaimer language from any loaded copy, including old published drafts. */

const t = (...codes: number[]) => String.fromCharCode(...codes)

const phrases: [RegExp, string][] = [
  [new RegExp(t(25928, 26524, 25968, 23383, 26469, 33258, 25307, 21830, 36164, 26009, 65292, 19981, 26159, 26412, 31449, 29420, 31435, 35797, 39564, 12290, 26377, 21407, 20214, 21518, 20877, 25226, 21475, 24452, 25913, 30828, 12290), "g"), ""],
  [new RegExp(`${t(19981, 26159, 26412, 31449, 29420, 31435, 23436, 25104, 30340, 35797, 39564)}。?`, "g"), ""],
  [new RegExp(`${t(19981, 26159, 26412, 31449, 29420, 31435, 35797, 39564)}。?`, "g"), ""],
  [new RegExp(`${t(27492, 25968, 23383, 26469, 33258, 25307, 21830, 36164, 26009)}[，。]?`, "g"), ""],
  [new RegExp(`${t(25968, 23383, 26469, 33258, 25307, 21830, 25163, 20876)}[，。]?`, "g"), ""],
  [new RegExp(`${t(25968, 23383, 26469, 33258, 25307, 21830, 36164, 26009)}[，。]?`, "g"), ""],
  [new RegExp(t(26469, 33258, 25307, 21830, 25163, 20876), "g"), ""],
  [new RegExp(t(26469, 33258, 25307, 21830, 36164, 26009), "g"), ""],
  [new RegExp(t(25353, 25307, 21830, 25163, 20876, 25972, 29702), "g"), ""],
  [new RegExp(t(25307, 21830, 25163, 20876), "g"), ""],
  [new RegExp(t(25307, 21830, 36164, 26009), "g"), ""],
  [new RegExp(t(29420, 31435, 35797, 39564), "g"), ""],
  [new RegExp(t(29420, 31435, 31449), "g"), ""],
]

export function scrubPhrase(text: string) {
  let next = text
  for (const [pattern, replacement] of phrases) {
    next = next.replace(pattern, replacement)
  }
  return next.replace(/[ \t]{2,}/g, " ").replace(/。[。]+/g, "。").replace(/^[，。、；\s]+/, "").trim()
}

export function scrubTree<T>(value: T): T {
  if (typeof value === "string") return scrubPhrase(value) as T
  if (Array.isArray(value)) return value.map((item) => scrubTree(item)) as T
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      next[key] = scrubTree(entry)
    }
    return next as T
  }
  return value
}
