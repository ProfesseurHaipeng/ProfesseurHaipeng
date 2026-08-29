import type { SiteContent } from "./types"

function line(title: string, body = "") {
  const head = title.trim()
  const text = body.trim()
  if (!head && !text) return ""
  if (!text) return head
  return `${head}：${text}`
}

/** Flatten published site copy into a brief the on-site guide can quote. */
export function flattenKnowledge(content: SiteContent): string {
  const { settings, hero, overview, resource, supply, products, testing, market, solutions, cases, videos, contact } =
    content
  const blocks: string[] = [
    "这是菲律宾皮纳图博火山灰农业综合产业项目官网。品牌尚未最终落实。检测数字与效果以最新批次报告和田间记录为准。",
    line("产品名", settings.productName || "皮纳图博火山灰"),
    line("项目名", settings.projectName),
    line("定位", settings.tagline),
    line("受众", settings.audience),
    line("站点结构", "首页 / 项目 / 产品 / 应用 / 案例 / 联络。旧路径 /resource 会转到项目，/supply 与 /testing 转到产品，/market 与 /solutions 转到应用，/videos 转到案例。"),
    "",
    "【首页】",
    line("标题", hero.title),
    line("导语", hero.subtitle),
    ...hero.points.map((item) => `- ${item}`),
    ...products.stats.map((item) => line(item.label, `${item.value}。${item.body}`)),
    "",
    "【项目页 /project，分栏：战略 / 资源 / 矿物】",
    line(overview.title, overview.intro.join(" ")),
    line(overview.strategyTitle, overview.strategyLead),
    ...overview.pillars.map((item) => line(item.title, item.body)),
    ...overview.strategyLayers.map((item) => line(item.title, item.body)),
    ...overview.values.map((item) => line(item.title, item.body)),
    line(resource.title, resource.background.join(" ")),
    line(resource.formationTitle, resource.formationLead),
    ...resource.formationSteps.map((item) => line(item.title, item.body)),
    ...resource.traits.map((item) => line(item.title, item.body)),
    line(resource.mineralsTitle, resource.mineralsLead),
    ...resource.minerals.map((item) => line(`${item.name}（${item.symbol}）`, item.body)),
    "",
    "【产品页 /products，分栏：方向 / 改土 / 检测 / 供应 / 包装】",
    line(products.title, products.source.join(" ")),
    ...products.directions.map((item) => line(item.title, item.body)),
    line(products.soilTitle),
    ...products.soil.map((item) => line(item.title, item.body)),
    line(products.fertilizerTitle, products.fertilizerLead),
    ...products.fertilizer.map((item) => line(item.title, item.body)),
    line(products.livestockTitle),
    ...products.livestock.map((item) => line(item.title, item.body)),
    ...products.other.map((item) => line(item.title, item.body)),
    line(testing.title, testing.intro),
    ...testing.layers.map((item) => line(item.title, item.body)),
    line(testing.assayTitle, testing.assayLead),
    ...testing.assay.map((item) => line(`${item.name} ${item.symbol}`, `${item.amount}% ${item.meaning}`)),
    line("检测备注", testing.assayNote),
    line(supply.title, supply.mineBody),
    ...supply.rawPoints.map((item) => line(item.title, item.body)),
    ...supply.process.map((item) => line(item.title, item.body)),
    ...supply.shipping.map((item) => line(item.title, item.body)),
    line("供应备注", supply.shippingNote),
    ...products.packs.map((item) => line(item.title, item.body)),
    ...products.capacity.map((item) => line(item.title, item.body)),
    line("目标客户", products.customers.join("、")),
    "",
    "【应用页 /use，可用 ?crop= 过滤作物】",
    line(solutions.title, solutions.crops),
    line(market.title, market.lead),
    ...solutions.schemes.map((item) =>
      line(item.crop, `${item.value} 用量：${item.dosage} 方法：${item.method}`),
    ),
    ...solutions.extras.map((item) => line(item.title, item.body)),
    line(solutions.principlesTitle, solutions.principles.join("；")),
    ...market.groups.flatMap((group) => [
      line(group.title, group.insight),
      ...group.regions.map((region) =>
        line(region.name, `土壤：${region.soil} 作物：${region.crops} 方向：${region.directions}`),
      ),
    ]),
    "",
    "【案例页 /cases】",
    line(cases.title, cases.compareLead),
    ...cases.items.map(
      (item) =>
        `${item.title}：${item.intro} 背景：${item.background} 做法：${item.solution} 效果：${item.effects.join("；")} ${item.value}`,
    ),
    line(cases.beforeTitle, cases.before.join("；")),
    line(cases.afterTitle, cases.after.join("；")),
    line(videos.title, videos.lead),
    ...videos.items.map((item) => line(item.title, item.body)),
    line("视频备注", videos.note),
    "",
    "【联络页 /contact】",
    line(contact.title, contact.lead),
    ...contact.cards.map((item) => line(item.title, item.body)),
    line("口号", contact.slogan),
    line("邮箱", settings.channels.email || "尚未公开，请在联络表单留下线索"),
    line("电话", settings.channels.phone || "尚未公开"),
    line("微信", settings.channels.wechat || "尚未公开"),
    line("地址", settings.channels.address || "尚未公开"),
    line("后台", "内容可在 /admin 修改，口令由站点管理员掌握，不要对访客泄露。"),
    "配图目前是示意画面，不是矿区现场原片。有原片后可在后台替换。",
  ]

  return blocks.filter(Boolean).join("\n")
}

export function localGuideAnswer(question: string, knowledge: string): string {
  const q = question.trim()
  if (!q) return "请先问一个具体问题，例如作物、检测或怎么联络。"

  const lines = knowledge.split("\n").map((item) => item.trim()).filter(Boolean)
  const tokens = tokensFrom(q)
  const scored = lines
    .map((line) => {
      const hay = line.toLowerCase()
      const title = hay.split("：")[0] ?? ""
      const score = tokens.reduce((sum, token) => {
        let next = sum
        if (hay.includes(token)) next += token.length
        if (title === token || title.startsWith(`${token}（`)) next += 8
        return next
      }, 0)
      return { line, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  if (scored.length === 0) {
    return "我是本站导览。可以介绍项目、产品、改土、检测、供应、作物方案、案例和联络方式。请尽量用站点里的词来问，例如「水稻怎么用」「月供应多少」「怎么谈合作」。"
  }

  return `根据本站现有文案：\n\n${scored.map((item) => `· ${item.line}`).join("\n")}\n\n数字与效果以最新检测和田间记录为准。若要谈样品，请到「联络」页留下作物和吨位。`
}

function tokensFrom(question: string) {
  const lower = question.toLowerCase()
  const parts = lower.split(/[\s,，。？?、！!]+/).filter(Boolean)
  const grams: string[] = []
  for (const part of parts) {
    grams.push(part)
    const chars = [...part]
    for (let i = 0; i < chars.length - 1; i += 1) {
      grams.push(chars.slice(i, i + 2).join(""))
    }
  }
  return [...new Set(grams.filter((item) => item.length >= 2))]
}
