import { describe, expect, it } from "vitest"
import { isHashBuild, routerBasename, withBase } from "../lib/asset"

describe("withBase", () => {
  it("keeps remote urls untouched", () => {
    expect(withBase("https://example.com/a.jpg")).toBe("https://example.com/a.jpg")
  })

  it("joins site media to the Vite base", () => {
    expect(withBase("/media/ash_luzon.jpg")).toMatch(/media\/ash_luzon\.jpg$/)
  })
})

describe("routerBasename", () => {
  it("omits basename when the app is served at root", () => {
    expect(routerBasename() === undefined || routerBasename() === "").toBe(true)
  })
})

describe("isHashBuild", () => {
  it("stays off unless the CDN build sets VITE_HASH", () => {
    expect(isHashBuild()).toBe(false)
  })
})
