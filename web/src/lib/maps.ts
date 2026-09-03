/** Mount Pinatubo, central-western Luzon. */
export const PINATUBO = {
  lat: 15.142,
  lng: 120.35,
  zoom: 10,
  query: "Mount Pinatubo, Luzon, Philippines",
  caption: "皮纳图博火山 · 吕宋岛中西部实图位置",
}

export function googleMapsEmbedSrc(place = PINATUBO) {
  const q = encodeURIComponent(place.query)
  return `https://maps.google.com/maps?q=${q}&hl=zh-CN&z=${place.zoom}&output=embed`
}

export function googleMapsOpenHref(place = PINATUBO) {
  const q = encodeURIComponent(place.query)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

export function osmEmbedSrc(place = PINATUBO) {
  const pad = 0.72
  const west = (place.lng - pad).toFixed(4)
  const south = (place.lat - pad).toFixed(4)
  const east = (place.lng + pad).toFixed(4)
  const north = (place.lat + pad).toFixed(4)
  return `https://www.openstreetmap.org/export/embed.html?bbox=${west},${south},${east},${north}&layer=mapnik&marker=${place.lat},${place.lng}`
}
