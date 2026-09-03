import { describe, expect, it } from "vitest"
import { CHINA_DASH_LINE, CHINA_PROVINCES, matchProvince } from "./chinaGeo"

describe("chinaGeo", () => {
  it("keeps every province-level unit including HK, Macao, and Taiwan", () => {
    const names = CHINA_PROVINCES.map((item) => item.name)
    expect(names).toHaveLength(34)
    expect(names).toContain("台湾省")
    expect(names).toContain("香港特别行政区")
    expect(names).toContain("澳门特别行政区")
    expect(CHINA_DASH_LINE.length).toBeGreaterThan(100)
  })

  it("matches market region names to provinces", () => {
    expect(matchProvince("江西")?.name).toBe("江西省")
    expect(matchProvince("湖南南部")?.name).toBe("湖南省")
    expect(matchProvince("广西")?.name).toBe("广西壮族自治区")
    expect(matchProvince("香港")?.name).toBe("香港特别行政区")
    expect(matchProvince("不存在的地方")).toBeNull()
  })
})
