import type { ContentGap, SiteContent } from "./types"

function statusFor(value: string, draftHint = false): ContentGap["status"] {
  if (!value.trim()) return "empty"
  return draftHint ? "draft" : "ready"
}

export function deriveGaps(content: SiteContent): ContentGap[] {
  const { settings } = content
  return [
    {
      id: "brand",
      label: "品牌名称",
      why: "页眉和浏览器标题在品牌空着时会退回产品名。",
      example: "中文名、英文名、不希望被叫成什么。",
      status: statusFor(settings.brandName),
      value: settings.brandName,
    },
    {
      id: "line",
      label: "一句定位",
      why: "首页主句应来自品牌定位，而不是长期停在阶段说明。",
      example: "「把皮纳图博火山灰做成可核对的农业矿物投入」。",
      status: statusFor(settings.tagline, true),
      value: settings.tagline,
    },
    {
      id: "email",
      label: "对外邮箱",
      why: "联络页现在只有便条，没有正式邮箱。",
      example: "公开可回复的邮箱。",
      status: statusFor(settings.channels.email),
      value: settings.channels.email,
    },
    {
      id: "phone",
      label: "对外电话",
      why: "合作方需要一个能打通的号码。",
      example: "含区号的电话。",
      status: statusFor(settings.channels.phone),
      value: settings.channels.phone,
    },
    {
      id: "wechat",
      label: "微信或视频号",
      why: "视频链到微信，对外入口仍空着。",
      example: "微信号、视频号名。",
      status: statusFor(settings.channels.wechat),
      value: settings.channels.wechat,
    },
    {
      id: "address",
      label: "对外地址",
      why: "考察和寄送检测资料需要落点。",
      example: "城市 + 是否接受来访。",
      status: statusFor(settings.channels.address),
      value: settings.channels.address,
    },
    {
      id: "brochure",
      label: "资料下载",
      why: "站点还没有可下载的项目资料文件。",
      example: "/media/handbook.pdf 或网盘链接。",
      status: statusFor(settings.brochureUrl),
      value: settings.brochureUrl,
    },
  ]
}

export function emptyGapCount(content: SiteContent) {
  return deriveGaps(content).filter((gap) => gap.status === "empty").length
}
