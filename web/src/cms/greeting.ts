/** Location-aware greeting for the on-site sales guide. */

const CN_PROVINCES: Record<string, string> = {
  beijing: "北京",
  tianjin: "天津",
  hebei: "河北",
  shanxi: "山西",
  "inner mongolia": "内蒙古",
  liaoning: "辽宁",
  jilin: "吉林",
  heilongjiang: "黑龙江",
  shanghai: "上海",
  jiangsu: "江苏",
  zhejiang: "浙江",
  anhui: "安徽",
  fujian: "福建",
  jiangxi: "江西",
  shandong: "山东",
  henan: "河南",
  hubei: "湖北",
  hunan: "湖南",
  guangdong: "广东",
  guangxi: "广西",
  hainan: "海南",
  chongqing: "重庆",
  sichuan: "四川",
  guizhou: "贵州",
  yunnan: "云南",
  tibet: "西藏",
  xizang: "西藏",
  shaanxi: "陕西",
  gansu: "甘肃",
  qinghai: "青海",
  ningxia: "宁夏",
  xinjiang: "新疆",
  "hong kong": "香港",
  macao: "澳门",
  macau: "澳门",
  taiwan: "台湾",
}

/** Turn IP-geo country/region names into a short Chinese place, or null. */
export function chinesePlace(countryCode?: string | null, regionName?: string | null): string | null {
  const code = (countryCode || "").trim().toUpperCase()
  if (!code) return null
  if (code === "CN") {
    const key = (regionName || "").trim().toLowerCase()
    return CN_PROVINCES[key] || "国内"
  }
  try {
    const name = new Intl.DisplayNames(["zh"], { type: "region" }).of(code)
    if (name && name !== code) return name
  } catch {
    /* runtimes without zh region names */
  }
  return null
}

export function buildGreeting(place: string | null): string {
  const opener = place
    ? `您好，看到您正从${place}访问，欢迎。我是本项目的产品顾问小林。`
    : "您好，欢迎来到皮纳图博火山灰项目。我是产品顾问小林。"
  return `${opener}

有什么我能帮您的？我先简单介绍一下：我们把菲律宾皮纳图博火山的天然火山灰，做成可核对的土壤改良与生态农业投入，面向农业集团、肥料企业和规模化种植企业。

您这边主要关注哪类作物或者哪个区域？我按您的情况直接讲重点。`
}

export type VisitorLang = "zh" | "en"

/** Mainland, HK, Macao, and Taiwan default to Chinese; everywhere else English. */
export function visitorLang(countryCode?: string | null): VisitorLang {
  const code = (countryCode || "").trim().toUpperCase()
  if (!code) return "zh"
  return code === "CN" || code === "HK" || code === "MO" || code === "TW" ? "zh" : "en"
}

/** Language of one message: CJK anywhere wins, otherwise Latin letters mean English. */
export function detectMessageLang(text: string): VisitorLang | null {
  if (/[\u3400-\u9fff\uf900-\ufaff]/.test(text)) return "zh"
  if (((text.match(/[a-z]/gi) || []).length) > 1) return "en"
  return null
}

/** The language this turn must be answered in: the customer's own language
 *  beats the geo default every time. */
export function replyLang(geoLang: VisitorLang, lastUserText: string | null | undefined): VisitorLang {
  return detectMessageLang(lastUserText || "") ?? geoLang
}

export function englishPlace(countryCode?: string | null): string | null {
  const code = (countryCode || "").trim().toUpperCase()
  if (!code) return null
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code)
    if (name && name !== code) return name
  } catch {
    /* runtimes without region names */
  }
  return null
}

export function buildGreetingEn(place: string | null): string {
  const opener = place
    ? `Hi, welcome. I can see you're visiting from ${place}. I'm Lin, the product advisor here.`
    : "Hi, welcome. I'm Lin, the product advisor here."
  return `${opener}

Quick intro: we turn natural volcanic ash from Mount Pinatubo in the Philippines into verifiable soil-improvement and eco-agriculture inputs, working with agri groups, fertilizer makers, and large-scale growers.

What brings you here? Tell me your crop or region and I'll get straight to what matters for you.`
}
