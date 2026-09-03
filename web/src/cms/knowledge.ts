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
    "这是菲律宾皮纳图博火山灰农业综合产业项目官网。",
    line("产品名", settings.productName || "皮纳图博火山灰"),
    line("项目名", settings.projectName),
    line("定位", settings.tagline),
    line("受众", settings.audience),
    line("站点结构", "首页 / 项目 / 产品 / 应用 / 案例 / 联络。旧路径 /resource 会转到项目，/supply 与 /testing 转到产品，/market 与 /solutions 转到应用，/videos 转到案例。"),
    "首页「吕宋岛中西部」是谷歌地图实图，标记皮纳图博火山（Mount Pinatubo，约北纬 15.14°、东经 120.35°），地处邦板牙省、三描礼士省与苏比克湾自由港区交界，距苏比克湾约 80 公里。国内网络若谷歌地图未加载，会改用开放街图，仍指向同一坐标。",
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
    line("邮箱", settings.channels.email || "请在联络页留下线索"),
    line("电话", settings.channels.phone || "请在联络页留下线索"),
    line("微信", settings.channels.wechat || "请在联络页留下线索"),
    line("地址", settings.channels.address || "请在联络页留下线索"),
  ]

  return blocks.filter(Boolean).join("\n")
}

export function isProductIntroAsk(question: string) {
  return /介绍|这是什么|什么产品|什么项目|你们卖什么|讲讲产品|说说产品|产品介绍|what is this|tell me about|introduce (the )?product/i.test(
    question,
  )
}

export function isOnTopicAdvisorAsk(question: string) {
  return /产品|项目|火山灰|皮纳图博|改土|检测|供应|合作|水稻|香蕉|芒果|柑橘|茶叶|甘蔗|样品|吨|介绍|pinatubo|ash|soil|rice|product|project/i.test(
    question,
  )
}

export function isScopeRefusal(text: string) {
  return /不在.{0,16}服务范围|超出.{0,10}(职责|范围)|outside the scope|not within (the )?scope|I can only assist/i.test(
    text,
  )
}

export function localProductIntro() {
  return "我们做的是皮纳图博火山灰，菲律宾吕宋岛皮纳图博火山喷发后，经过三十多年自然矿化的天然矿物，用来改土和做肥料基料。\n\n弱碱性，能调南方酸化土壤，硅、钙、镁、铁这些矿物一次补上。月供应能力在 50 万吨以上，散装、吨袋、小袋都能走。\n\n您那边主要种什么、大概多少亩或多少吨？我按这个给您说用量。"
}

export function localGuideAnswer(question: string, knowledge: string): string {
  const q = question.trim()
  if (!q) return "请先问一个具体问题，例如作物、检测或怎么联络。"
  if (isProductIntroAsk(q)) return localProductIntro()

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

  return `${scored.map((item) => `· ${item.line}`).join("\n")}\n\n若要谈样品或检测，请到「联络」页留下作物和吨位。`
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
