// Build a full vertical China map SVG (all 34 province-level units incl.
// Taiwan, Hong Kong, Macao, plus the South China Sea ten-dash line) from
// DataV/AutoNavi boundaries, highlighting the market-focus provinces.
// Usage: node scripts/build-china-map.mjs [path/to/100000_full.json]
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const source = process.argv[2] || "/tmp/china_full.json"
const out = resolve(process.cwd(), "public/media/china_map.svg")
const geo = JSON.parse(readFileSync(source, "utf8"))

const HIGHLIGHT = new Set(["江西省", "湖南省", "广西壮族自治区", "福建省", "浙江省", "云南省", "海南省", "广东省"])
const SHORT = {
  江西省: "江西",
  湖南省: "湖南",
  广西壮族自治区: "广西",
  福建省: "福建",
  浙江省: "浙江",
  云南省: "云南",
  海南省: "海南",
  广东省: "广东",
  台湾省: "台湾",
  香港特别行政区: "香港",
  澳门特别行政区: "澳门",
}

// Vertical-map extent: whole territory incl. South China Sea islands.
const LON = [73.2, 135.4]
const LAT = [2.6, 53.9]
const W = 760
const K = W / ((LON[1] - LON[0]) * Math.cos((32 * Math.PI) / 180))
const H = Math.round((LAT[1] - LAT[0]) * K)

const px = (lon, lat) => [
  ((lon - LON[0]) * K * Math.cos((32 * Math.PI) / 180)).toFixed(1),
  ((LAT[1] - lat) * K).toFixed(1),
]

function ringPath(ring) {
  const pts = ring.length > 320 ? ring.filter((_, i) => i % 2 === 0) : ring
  let d = ""
  let last = ""
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = px(pts[i][0], pts[i][1])
    const key = `${x},${y}`
    if (key === last) continue
    d += (d ? "L" : "M") + key
    last = key
  }
  return d ? `${d}Z` : ""
}

function featurePath(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
  return polys
    .flatMap((poly) => poly.map(ringPath))
    .filter(Boolean)
    .join("")
}

const shapes = []
const labels = []

for (const feature of geo.features) {
  const { name, adcode, center, centroid } = feature.properties
  const d = featurePath(feature.geometry)
  if (!d) continue
  if (String(adcode) === "100000_JD") {
    shapes.push(`<path d="${d}" fill="#7b80d4" stroke="#7b80d4" stroke-width="1.4"/>`)
    continue
  }
  const on = HIGHLIGHT.has(name)
  shapes.push(
    `<path d="${d}" fill="${on ? "#7b80d4" : "#e8eaf6"}" fill-opacity="${on ? "0.92" : "1"}" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round"/>`,
  )
  const anchor = centroid || center
  if (anchor && SHORT[name]) {
    const [x, y] = px(anchor[0], anchor[1])
    labels.push({ name: SHORT[name], x: Number(x), y: Number(y), on })
  }
}

const labelSvg = labels
  .map(({ name, x, y, on }) => {
    if (name === "香港") {
      return `<line x1="${x}" y1="${y}" x2="${x + 34}" y2="${y + 26}" stroke="#5f5f6a" stroke-width="1"/><text x="${x + 37}" y="${y + 31}" font-size="15" fill="#111111">香港</text>`
    }
    if (name === "澳门") {
      return `<line x1="${x}" y1="${y}" x2="${x - 16}" y2="${y + 40}" stroke="#5f5f6a" stroke-width="1"/><text x="${x - 50}" y="${y + 54}" font-size="15" fill="#111111">澳门</text>`
    }
    const fill = on ? "#ffffff" : "#111111"
    return `<text x="${x}" y="${y}" font-size="16" text-anchor="middle" fill="${fill}" font-weight="600">${name}</text>`
  })
  .join("\n")

const seaLabel = (() => {
  const [x, y] = px(112.5, 12.5)
  return `<text x="${x}" y="${y}" font-size="15" fill="#5f5f6a" text-anchor="middle" letter-spacing="4">南海诸岛</text>`
})()

const legend = `
<g font-size="15" fill="#111111">
  <rect x="26" y="${H - 66}" width="16" height="16" rx="3" fill="#7b80d4"/>
  <text x="50" y="${H - 53}">重点布局区域</text>
  <rect x="26" y="${H - 40}" width="16" height="16" rx="3" fill="#e8eaf6" stroke="#d5d8ee"/>
  <text x="50" y="${H - 27}">中国其他省份</text>
</g>`

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 中国地图（竖版，含台湾、香港、澳门与南海诸岛）。边界数据：DataV.GeoAtlas（高德） -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="中国农业市场布局地图，含香港、澳门、台湾与南海诸岛" font-family="'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans SC',sans-serif">
<rect width="${W}" height="${H}" fill="#f7f8fc"/>
${shapes.join("\n")}
${labelSvg}
${seaLabel}
${legend}
</svg>
`

writeFileSync(out, svg)
console.log("wrote", out, Math.round(svg.length / 1024), "KB", `${W}x${H}`)
