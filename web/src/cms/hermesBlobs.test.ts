import { describe, expect, it } from "vitest"
import { mergeStoredCases, preferHermesCase } from "./hermesBlobs"
import type { HermesCase } from "./hermesDesk"

const now = "2026-09-03T12:00:00.000Z"

function row(partial: Partial<HermesCase> = {}): HermesCase {
  return {
    id: "case-1",
    at: now,
    updatedAt: now,
    name: "王先生",
    org: "某农业集团",
    contact: "13800000000",
    note: "江西水稻",
    owner: "hermes",
    following: true,
    progress: "talking",
    reaction: "",
    evaluation: "",
    energy: "unset",
    source: "ai",
    ...partial,
  }
}

describe("hermes case snapshot merge", () => {
  it("lets a tombstone win over a newer live copy of the same id", () => {
    const live = row({ gone: false, updatedAt: "2026-09-03T13:00:00.000Z" })
    const gone = row({ gone: true, updatedAt: "2026-09-03T12:00:00.000Z" })
    expect(preferHermesCase(live, gone).gone).toBe(true)
    expect(preferHermesCase(gone, live).gone).toBe(true)
  })

  it("keeps the newer live row when neither copy is gone", () => {
    const older = row({ note: "旧", updatedAt: "2026-09-03T11:00:00.000Z" })
    const newer = row({ note: "新", updatedAt: "2026-09-03T13:00:00.000Z" })
    expect(preferHermesCase(older, newer).note).toBe("新")
  })

  it("merges snapshot and listed keys without reviving a deleted id", () => {
    const snapshot = [
      row({ id: "case-keep", note: "还在" }),
      row({ id: "case-gone", gone: true, updatedAt: "2026-09-03T12:30:00.000Z" }),
    ]
    const listed = [
      row({ id: "case-gone", gone: false, updatedAt: "2026-09-03T13:00:00.000Z", note: "列表还是活的" }),
      row({ id: "case-extra", note: "旧键多出来的" }),
    ]
    const merged = mergeStoredCases(snapshot, listed)
    expect(merged.find((item) => item.id === "case-gone")?.gone).toBe(true)
    expect(merged.find((item) => item.id === "case-keep")?.note).toBe("还在")
    expect(merged.find((item) => item.id === "case-extra")?.note).toBe("旧键多出来的")
  })
})
