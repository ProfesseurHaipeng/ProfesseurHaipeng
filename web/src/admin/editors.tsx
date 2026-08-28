import type { ContentModuleId, SiteContent } from "../cms/types"
import { BlockList, CheckField, Field, StringList } from "./fields"

type EditorProps = {
  content: SiteContent
  onChange: (content: SiteContent) => void
}

function patch<K extends keyof SiteContent>(
  content: SiteContent,
  onChange: (content: SiteContent) => void,
  key: K,
  value: SiteContent[K],
) {
  onChange({ ...content, [key]: value })
}

export function ModuleEditor({
  moduleId,
  content,
  onChange,
}: EditorProps & { moduleId: ContentModuleId }) {
  switch (moduleId) {
    case "settings":
      return (
        <section className="admin-module">
          <Field
            label="品牌名称（空着则前台用产品名）"
            value={content.settings.brandName}
            onChange={(brandName) =>
              patch(content, onChange, "settings", { ...content.settings, brandName })
            }
          />
          <Field
            label="品牌状态"
            value={content.settings.brandStatus}
            onChange={(brandStatus) =>
              patch(content, onChange, "settings", { ...content.settings, brandStatus })
            }
          />
          <Field
            label="产品名"
            value={content.settings.productName}
            onChange={(productName) =>
              patch(content, onChange, "settings", { ...content.settings, productName })
            }
          />
          <Field
            label="英文名"
            value={content.settings.latinName}
            onChange={(latinName) =>
              patch(content, onChange, "settings", { ...content.settings, latinName })
            }
          />
          <Field
            label="项目全称"
            value={content.settings.projectName}
            onChange={(projectName) =>
              patch(content, onChange, "settings", { ...content.settings, projectName })
            }
          />
          <Field
            label="一句定位"
            value={content.settings.tagline}
            onChange={(tagline) =>
              patch(content, onChange, "settings", { ...content.settings, tagline })
            }
          />
          <Field
            label="面向谁"
            value={content.settings.audience}
            onChange={(audience) =>
              patch(content, onChange, "settings", { ...content.settings, audience })
            }
          />
          <Field
            label="站点描述"
            multiline
            value={content.settings.description}
            onChange={(description) =>
              patch(content, onChange, "settings", { ...content.settings, description })
            }
          />
          <Field
            label="页脚说明"
            multiline
            value={content.settings.footerNote}
            onChange={(footerNote) =>
              patch(content, onChange, "settings", { ...content.settings, footerNote })
            }
          />
          <Field
            label="联络页提示"
            multiline
            value={content.settings.contactHint}
            onChange={(contactHint) =>
              patch(content, onChange, "settings", { ...content.settings, contactHint })
            }
          />
          <CheckField
            label="暂不让搜索引擎收录"
            checked={content.settings.noIndex}
            onChange={(noIndex) =>
              patch(content, onChange, "settings", { ...content.settings, noIndex })
            }
          />
        </section>
      )
    case "nav":
      return (
        <BlockList
          label="导航"
          items={content.nav}
          onChange={(nav) => patch(content, onChange, "nav", nav)}
          blank={() => ({ label: "新栏目", href: "/" })}
        >
          {(item, update) => (
            <>
              <Field label="名称" value={item.label} onChange={(label) => update({ label })} />
              <Field label="路径" value={item.href} onChange={(href) => update({ href })} />
            </>
          )}
        </BlockList>
      )
    case "hero":
      return (
        <section className="admin-module">
          <Field
            label="眉题"
            value={content.hero.kicker}
            onChange={(kicker) => patch(content, onChange, "hero", { ...content.hero, kicker })}
          />
          <Field
            label="主标题"
            value={content.hero.title}
            onChange={(title) => patch(content, onChange, "hero", { ...content.hero, title })}
          />
          <Field
            label="副标题"
            value={content.hero.subtitle}
            onChange={(subtitle) => patch(content, onChange, "hero", { ...content.hero, subtitle })}
          />
          <StringList
            label="要点"
            items={content.hero.points}
            onChange={(points) => patch(content, onChange, "hero", { ...content.hero, points })}
          />
          <Field
            label="主图路径"
            value={content.hero.image.src}
            onChange={(src) =>
              patch(content, onChange, "hero", { ...content.hero, image: { ...content.hero.image, src } })
            }
          />
          <Field
            label="主图说明"
            value={content.hero.image.alt}
            onChange={(alt) =>
              patch(content, onChange, "hero", { ...content.hero, image: { ...content.hero.image, alt } })
            }
          />
          <Field
            label="主按钮文字"
            value={content.hero.primaryCta.label}
            onChange={(label) =>
              patch(content, onChange, "hero", {
                ...content.hero,
                primaryCta: { ...content.hero.primaryCta, label },
              })
            }
          />
          <Field
            label="主按钮链接"
            value={content.hero.primaryCta.href}
            onChange={(href) =>
              patch(content, onChange, "hero", {
                ...content.hero,
                primaryCta: { ...content.hero.primaryCta, href },
              })
            }
          />
          <Field
            label="次按钮文字"
            value={content.hero.secondaryCta.label}
            onChange={(label) =>
              patch(content, onChange, "hero", {
                ...content.hero,
                secondaryCta: { ...content.hero.secondaryCta, label },
              })
            }
          />
          <Field
            label="次按钮链接"
            value={content.hero.secondaryCta.href}
            onChange={(href) =>
              patch(content, onChange, "hero", {
                ...content.hero,
                secondaryCta: { ...content.hero.secondaryCta, href },
              })
            }
          />
        </section>
      )
    case "overview":
      return (
        <section className="admin-module">
          <Field
            label="章节眉题"
            value={content.overview.kicker}
            onChange={(kicker) =>
              patch(content, onChange, "overview", { ...content.overview, kicker })
            }
          />
          <Field
            label="标题"
            value={content.overview.title}
            onChange={(title) => patch(content, onChange, "overview", { ...content.overview, title })}
          />
          <StringList
            label="介绍段落"
            items={content.overview.intro}
            onChange={(intro) => patch(content, onChange, "overview", { ...content.overview, intro })}
          />
          <BlockList
            label="资源端 / 产业端"
            items={content.overview.pillars}
            onChange={(pillars) =>
              patch(content, onChange, "overview", { ...content.overview, pillars })
            }
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <Field
            label="战略标题"
            value={content.overview.strategyTitle}
            onChange={(strategyTitle) =>
              patch(content, onChange, "overview", { ...content.overview, strategyTitle })
            }
          />
          <Field
            label="战略导语"
            multiline
            value={content.overview.strategyLead}
            onChange={(strategyLead) =>
              patch(content, onChange, "overview", { ...content.overview, strategyLead })
            }
          />
          <BlockList
            label="战略层级"
            items={content.overview.strategyLayers}
            onChange={(strategyLayers) =>
              patch(content, onChange, "overview", { ...content.overview, strategyLayers })
            }
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="层名" value={item.title} onChange={(title) => update({ title })} />
                <Field label="说明" value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <Field
            label="价值体系标题"
            value={content.overview.valuesTitle}
            onChange={(valuesTitle) =>
              patch(content, onChange, "overview", { ...content.overview, valuesTitle })
            }
          />
          <Field
            label="价值体系配图"
            value={content.overview.valuesImage.src}
            onChange={(src) =>
              patch(content, onChange, "overview", {
                ...content.overview,
                valuesImage: { ...content.overview.valuesImage, src },
              })
            }
          />
          <BlockList
            label="价值条目"
            items={content.overview.values}
            onChange={(values) => patch(content, onChange, "overview", { ...content.overview, values })}
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
        </section>
      )
    case "resource":
      return (
        <section className="admin-module">
          <Field
            label="标题"
            value={content.resource.title}
            onChange={(title) => patch(content, onChange, "resource", { ...content.resource, title })}
          />
          <StringList
            label="背景段落"
            items={content.resource.background}
            onChange={(background) =>
              patch(content, onChange, "resource", { ...content.resource, background })
            }
          />
          <Field
            label="配图路径"
            value={content.resource.image.src}
            onChange={(src) =>
              patch(content, onChange, "resource", {
                ...content.resource,
                image: { ...content.resource.image, src },
              })
            }
          />
          <Field
            label="形成机制导语"
            multiline
            value={content.resource.formationLead}
            onChange={(formationLead) =>
              patch(content, onChange, "resource", { ...content.resource, formationLead })
            }
          />
          <BlockList
            label="形成步骤"
            items={content.resource.formationSteps}
            onChange={(formationSteps) =>
              patch(content, onChange, "resource", { ...content.resource, formationSteps })
            }
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="步骤" value={item.title} onChange={(title) => update({ title })} />
                <Field label="说明" value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <BlockList
            label="资源特点"
            items={content.resource.traits}
            onChange={(traits) => patch(content, onChange, "resource", { ...content.resource, traits })}
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <BlockList
            label="矿物元素"
            items={content.resource.minerals}
            onChange={(minerals) =>
              patch(content, onChange, "resource", { ...content.resource, minerals })
            }
            blank={() => ({ name: "", symbol: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="名称" value={item.name} onChange={(name) => update({ name })} />
                <Field label="符号" value={item.symbol} onChange={(symbol) => update({ symbol })} />
                <Field label="说明" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
        </section>
      )
    case "supply":
      return (
        <section className="admin-module">
          <Field
            label="矿区说明"
            multiline
            value={content.supply.mineBody}
            onChange={(mineBody) => patch(content, onChange, "supply", { ...content.supply, mineBody })}
          />
          <Field
            label="矿区图"
            value={content.supply.mineImage.src}
            onChange={(src) =>
              patch(content, onChange, "supply", {
                ...content.supply,
                mineImage: { ...content.supply.mineImage, src },
              })
            }
          />
          <BlockList
            label="原料要点"
            items={content.supply.rawPoints}
            onChange={(rawPoints) =>
              patch(content, onChange, "supply", { ...content.supply, rawPoints })
            }
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <BlockList
            label="加工步骤"
            items={content.supply.process}
            onChange={(process) => patch(content, onChange, "supply", { ...content.supply, process })}
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="步骤" value={item.title} onChange={(title) => update({ title })} />
                <Field label="说明" value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <BlockList
            label="海运要点"
            items={content.supply.shipping}
            onChange={(shipping) => patch(content, onChange, "supply", { ...content.supply, shipping })}
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
        </section>
      )
    case "products":
      return (
        <section className="admin-module">
          <StringList
            label="产品来源"
            items={content.products.source}
            onChange={(source) => patch(content, onChange, "products", { ...content.products, source })}
          />
          <BlockList
            label="关键数字"
            items={content.products.stats}
            onChange={(stats) => patch(content, onChange, "products", { ...content.products, stats })}
            blank={() => ({ value: "", label: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="数字" value={item.value} onChange={(value) => update({ value })} />
                <Field label="标签" value={item.label} onChange={(label) => update({ label })} />
                <Field label="说明" value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <BlockList
            label="应用方向"
            items={content.products.directions}
            onChange={(directions) =>
              patch(content, onChange, "products", { ...content.products, directions })
            }
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <BlockList
            label="土壤改良"
            items={content.products.soil}
            onChange={(soil) => patch(content, onChange, "products", { ...content.products, soil })}
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <BlockList
            label="肥基料"
            items={content.products.fertilizer}
            onChange={(fertilizer) =>
              patch(content, onChange, "products", { ...content.products, fertilizer })
            }
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <BlockList
            label="畜牧"
            items={content.products.livestock}
            onChange={(livestock) =>
              patch(content, onChange, "products", { ...content.products, livestock })
            }
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <BlockList
            label="包装"
            items={content.products.packs}
            onChange={(packs) => patch(content, onChange, "products", { ...content.products, packs })}
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="规格" value={item.title} onChange={(title) => update({ title })} />
                <Field label="说明" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <StringList
            label="目标客户"
            items={content.products.customers}
            onChange={(customers) =>
              patch(content, onChange, "products", { ...content.products, customers })
            }
          />
        </section>
      )
    case "testing":
      return (
        <section className="admin-module">
          <Field
            label="导语"
            multiline
            value={content.testing.intro}
            onChange={(intro) => patch(content, onChange, "testing", { ...content.testing, intro })}
          />
          <BlockList
            label="检测层级"
            items={content.testing.layers}
            onChange={(layers) => patch(content, onChange, "testing", { ...content.testing, layers })}
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <BlockList
            label="资料类型"
            items={content.testing.docs}
            onChange={(docs) => patch(content, onChange, "testing", { ...content.testing, docs })}
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <BlockList
            label="检测指标"
            items={content.testing.assay}
            onChange={(assay) => patch(content, onChange, "testing", { ...content.testing, assay })}
            blank={() => ({ name: "", symbol: "", amount: "", meaning: "" })}
          >
            {(item, update) => (
              <>
                <Field label="矿物" value={item.name} onChange={(name) => update({ name })} />
                <Field label="符号" value={item.symbol} onChange={(symbol) => update({ symbol })} />
                <Field label="含量" value={item.amount} onChange={(amount) => update({ amount })} />
                <Field label="意义" value={item.meaning} onChange={(meaning) => update({ meaning })} />
              </>
            )}
          </BlockList>
          <Field
            label="表下说明"
            multiline
            value={content.testing.assayNote}
            onChange={(assayNote) =>
              patch(content, onChange, "testing", { ...content.testing, assayNote })
            }
          />
        </section>
      )
    case "market":
      return (
        <section className="admin-module">
          <Field
            label="导语"
            multiline
            value={content.market.lead}
            onChange={(lead) => patch(content, onChange, "market", { ...content.market, lead })}
          />
          <BlockList
            label="区域组"
            items={content.market.groups}
            onChange={(groups) => patch(content, onChange, "market", { ...content.market, groups })}
            blank={() => ({ title: "", insight: "", regions: [] })}
          >
            {(group, update) => (
              <>
                <Field label="组名" value={group.title} onChange={(title) => update({ title })} />
                <Field
                  label="组备注"
                  multiline
                  value={group.insight}
                  onChange={(insight) => update({ insight })}
                />
                <BlockList
                  label="省区"
                  items={group.regions}
                  onChange={(regions) => update({ regions })}
                  blank={() => ({ name: "", soil: "", crops: "", directions: "" })}
                >
                  {(region, updateRegion) => (
                    <>
                      <Field label="地区" value={region.name} onChange={(name) => updateRegion({ name })} />
                      <Field
                        label="土壤"
                        multiline
                        value={region.soil}
                        onChange={(soil) => updateRegion({ soil })}
                      />
                      <Field
                        label="作物"
                        value={region.crops}
                        onChange={(crops) => updateRegion({ crops })}
                      />
                      <Field
                        label="方向"
                        multiline
                        value={region.directions}
                        onChange={(directions) => updateRegion({ directions })}
                      />
                    </>
                  )}
                </BlockList>
              </>
            )}
          </BlockList>
        </section>
      )
    case "solutions":
      return (
        <section className="admin-module">
          <Field
            label="作物列表"
            value={content.solutions.crops}
            onChange={(crops) =>
              patch(content, onChange, "solutions", { ...content.solutions, crops })
            }
          />
          <BlockList
            label="作物方案"
            items={content.solutions.schemes}
            onChange={(schemes) =>
              patch(content, onChange, "solutions", { ...content.solutions, schemes })
            }
            blank={() => ({ crop: "", value: "", dosage: "", method: "" })}
          >
            {(item, update) => (
              <>
                <Field label="作物" value={item.crop} onChange={(crop) => update({ crop })} />
                <Field label="价值" multiline value={item.value} onChange={(value) => update({ value })} />
                <Field label="用量" value={item.dosage} onChange={(dosage) => update({ dosage })} />
                <Field
                  label="用法"
                  multiline
                  value={item.method}
                  onChange={(method) => update({ method })}
                />
              </>
            )}
          </BlockList>
          <BlockList
            label="其他经济作物"
            items={content.solutions.extras}
            onChange={(extras) =>
              patch(content, onChange, "solutions", { ...content.solutions, extras })
            }
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="作物" value={item.title} onChange={(title) => update({ title })} />
                <Field label="说明" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <StringList
            label="通用原则"
            items={content.solutions.principles}
            onChange={(principles) =>
              patch(content, onChange, "solutions", { ...content.solutions, principles })
            }
          />
        </section>
      )
    case "cases":
      return (
        <section className="admin-module">
          <BlockList
            label="案例"
            items={content.cases.items}
            onChange={(items) => patch(content, onChange, "cases", { ...content.cases, items })}
            blank={() => ({
              title: "",
              intro: "",
              background: "",
              solution: "",
              effects: [""],
              value: "",
            })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="导语" multiline value={item.intro} onChange={(intro) => update({ intro })} />
                <Field
                  label="背景"
                  multiline
                  value={item.background}
                  onChange={(background) => update({ background })}
                />
                <Field
                  label="方案"
                  multiline
                  value={item.solution}
                  onChange={(solution) => update({ solution })}
                />
                <StringList
                  label="效果"
                  items={item.effects}
                  onChange={(effects) => update({ effects })}
                />
                <Field label="合作价值" multiline value={item.value} onChange={(value) => update({ value })} />
              </>
            )}
          </BlockList>
          <Field
            label="对照标题"
            value={content.cases.compareTitle}
            onChange={(compareTitle) =>
              patch(content, onChange, "cases", { ...content.cases, compareTitle })
            }
          />
          <StringList
            label="施用前"
            items={content.cases.before}
            onChange={(before) => patch(content, onChange, "cases", { ...content.cases, before })}
          />
          <StringList
            label="施用后"
            items={content.cases.after}
            onChange={(after) => patch(content, onChange, "cases", { ...content.cases, after })}
          />
        </section>
      )
    case "videos":
      return (
        <section className="admin-module">
          <Field
            label="导语"
            multiline
            value={content.videos.lead}
            onChange={(lead) => patch(content, onChange, "videos", { ...content.videos, lead })}
          />
          <BlockList
            label="视频"
            items={content.videos.items}
            onChange={(items) => patch(content, onChange, "videos", { ...content.videos, items })}
            blank={() => ({ title: "", body: "", url: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="说明" multiline value={item.body} onChange={(body) => update({ body })} />
                <Field label="链接" value={item.url} onChange={(url) => update({ url })} />
              </>
            )}
          </BlockList>
          <Field
            label="页底说明"
            value={content.videos.note}
            onChange={(note) => patch(content, onChange, "videos", { ...content.videos, note })}
          />
        </section>
      )
    case "contact":
      return (
        <section className="admin-module">
          <Field
            label="标题"
            value={content.contact.title}
            onChange={(title) => patch(content, onChange, "contact", { ...content.contact, title })}
          />
          <Field
            label="导语"
            multiline
            value={content.contact.lead}
            onChange={(lead) => patch(content, onChange, "contact", { ...content.contact, lead })}
          />
          <BlockList
            label="邀请卡片"
            items={content.contact.cards}
            onChange={(cards) => patch(content, onChange, "contact", { ...content.contact, cards })}
            blank={() => ({ title: "", body: "" })}
          >
            {(item, update) => (
              <>
                <Field label="标题" value={item.title} onChange={(title) => update({ title })} />
                <Field label="正文" multiline value={item.body} onChange={(body) => update({ body })} />
              </>
            )}
          </BlockList>
          <Field
            label="口号"
            value={content.contact.slogan}
            onChange={(slogan) => patch(content, onChange, "contact", { ...content.contact, slogan })}
          />
        </section>
      )
    default:
      return null
  }
}

export const moduleMeta: { id: ContentModuleId; label: string }[] = [
  { id: "settings", label: "站点与品牌" },
  { id: "nav", label: "导航" },
  { id: "hero", label: "首页主视觉" },
  { id: "overview", label: "项目战略" },
  { id: "resource", label: "火山资源" },
  { id: "supply", label: "矿区供应" },
  { id: "products", label: "产品体系" },
  { id: "testing", label: "检测报告" },
  { id: "market", label: "市场布局" },
  { id: "solutions", label: "应用方案" },
  { id: "cases", label: "案例" },
  { id: "videos", label: "视频" },
  { id: "contact", label: "联络" },
]
