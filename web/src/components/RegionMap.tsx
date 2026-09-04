import { CHINA_DASH_LINE, CHINA_PROVINCES, CHINA_VIEWBOX, matchProvince } from "../lib/chinaGeo"

/** Mini China map (complete territory incl. HK/MO/TW and the South China Sea
 *  dash line) with one region highlighted so visitors can place it. */
export function RegionMap({ region }: { region: string }) {
  const hit = matchProvince(region)
  if (!hit) return null
  return (
    <figure className="region-map">
      <svg viewBox={CHINA_VIEWBOX} role="img" aria-label={`${region}在中国的位置`}>
        {CHINA_PROVINCES.map((province) => (
          <path
            key={province.name}
            d={province.d}
            fill={province.name === hit.name ? "#7b80d4" : "#e8eaf6"}
            stroke="#ffffff"
            strokeWidth={0.6}
            strokeLinejoin="round"
          />
        ))}
        <path d={CHINA_DASH_LINE} fill="#7b80d4" stroke="#7b80d4" strokeWidth={0.8} />
        <circle className="region-map__ping" cx={hit.cx} cy={hit.cy} r={4.5} fill="#e07a28" opacity={0.35} />
        <circle cx={hit.cx} cy={hit.cy} r={2.4} fill="#e07a28" />
      </svg>
      <figcaption>{region} · 在中国的位置</figcaption>
    </figure>
  )
}
