import { describe, expect, it } from "vitest"
import { parseProjectIdentityDenylist, stripDeniedIdentities } from "./projectIdentity"

describe("project identity denylist", () => {
  it("reads nested alias lists without exposing them in code", () => {
    const terms = parseProjectIdentityDenylist(
      JSON.stringify({
        public_acronyms: ["NAS"],
        runtime_aliases: ["Hermes", "weho"],
      }),
    )
    expect(terms).toEqual(expect.arrayContaining(["NAS", "Hermes", "weho"]))
    expect(parseProjectIdentityDenylist("not-json")).toEqual([])
  })

  it("scrubs denied names out of advisor prompts but keeps Linda", () => {
    const cleaned = stripDeniedIdentities("Hermes 和 Linda 还在 weho 内网", ["Linda"])
    expect(cleaned).not.toMatch(/Hermes|weho/i)
    expect(cleaned).toContain("Linda")
    expect(cleaned).not.toContain("Karmenai")
    expect(parseProjectIdentityDenylist(JSON.stringify({ names: ["Linda", "Hermes"] }))).toEqual(["Hermes"])
  })
})
