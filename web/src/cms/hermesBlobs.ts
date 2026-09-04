import { emptyInquiry, hydrateInquiryState, type InquiryState } from "./inquiryDesk"
import {
  emptyLedger,
  emptyMemory,
  hydrateLedger,
  canWriteLiveHermesCase,
  liveCases,
  sortHermesCases,
  type HermesCase,
  type HermesCoachTurn,
  type HermesEvent,
  type HermesLedger,
  type HermesMemory,
} from "./hermesDesk"
import type { HermesHealth } from "./hermes"

type BlobStore = {
  get: (key: string, options: { type: "json" }) => Promise<unknown>
  setJSON: (key: string, value: unknown) => Promise<void>
  delete?: (key: string) => Promise<void>
  list: () => Promise<{ blobs: { key: string }[] }>
}

export type HermesImageBlob = { mime: string; name: string; data: string }

async function store(name: string): Promise<BlobStore | null> {
  try {
    const { getStore } = await import("@netlify/blobs")
    return getStore(name) as unknown as BlobStore
  } catch {
    return null
  }
}

export async function readHermesLedger(): Promise<HermesLedger> {
  const blobs = await store("ash-hermes")
  if (!blobs) return emptyLedger()
  return hydrateLedger(await blobs.get("ledger", { type: "json" }))
}

export async function writeHermesLedger(ledger: HermesLedger) {
  const blobs = await store("ash-hermes")
  if (!blobs) return false
  await blobs.setJSON("ledger", ledger)
  return true
}

export async function readHermesCases(options: { includeGone?: boolean } = {}): Promise<HermesCase[]> {
  const blobs = await store("ash-hermes")
  if (!blobs) return []
  const ledger = await readHermesLedger()
  const { blobs: keys } = await blobs.list()
  const rows = await Promise.all(
    keys
      .filter((item) => item.key.startsWith("case-"))
      .map(async ({ key }) => {
        const value = await blobs.get(key, { type: "json" })
        if (!value || typeof value !== "object") return null
        const row = value as HermesCase
        return row.id ? row : null
      }),
  )
  const all = sortHermesCases(rows.filter((item): item is HermesCase => Boolean(item?.id)))
  return options.includeGone ? all : liveCases(all, ledger)
}

export async function writeHermesCase(item: HermesCase) {
  const blobs = await store("ash-hermes")
  if (!blobs) return false
  if (!item.gone) {
    const raw = await blobs.get(item.id, { type: "json" })
    const existing = raw && typeof raw === "object" && (raw as HermesCase).id ? (raw as HermesCase) : null
    const ledger = await readHermesLedger()
    if (!canWriteLiveHermesCase(item, existing, ledger)) return true
  }
  await blobs.setJSON(item.id, item)
  return true
}

export async function writeHermesCases(cases: HermesCase[]) {
  for (const item of cases) await writeHermesCase(item)
}

export async function readHermesCoach(): Promise<HermesCoachTurn[]> {
  const blobs = await store("ash-hermes")
  if (!blobs) return []
  const raw = await blobs.get("coach", { type: "json" })
  if (!raw || typeof raw !== "object") return []
  const turns = (raw as { turns?: HermesCoachTurn[] }).turns
  return Array.isArray(turns) ? turns.slice(-40) : []
}

export async function writeHermesCoach(turns: HermesCoachTurn[]) {
  const blobs = await store("ash-hermes")
  if (!blobs) return false
  await blobs.setJSON("coach", { turns: turns.slice(-40) })
  return true
}

export async function deleteHermesCase(id: string) {
  const blobs = await store("ash-hermes")
  if (!blobs || !id.startsWith("case-")) return false
  const existing = await blobs.get(id, { type: "json" })
  const row = existing && typeof existing === "object" ? (existing as HermesCase) : { id }
  await blobs.setJSON(id, { ...row, id, gone: true, updatedAt: new Date().toISOString() })
  return true
}

export async function readHermesMemory(): Promise<HermesMemory> {
  const blobs = await store("ash-hermes")
  if (!blobs) return emptyMemory()
  const raw = await blobs.get("memory", { type: "json" })
  if (!raw || typeof raw !== "object") return emptyMemory()
  const row = raw as Partial<HermesMemory>
  return {
    shared: typeof row.shared === "string" ? row.shared : "",
    desk: typeof row.desk === "string" ? row.desk : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  }
}

export async function writeHermesMemory(memory: HermesMemory) {
  const blobs = await store("ash-hermes")
  if (!blobs) return false
  await blobs.setJSON("memory", memory)
  return true
}

export async function readHermesEvents(): Promise<HermesEvent[]> {
  const blobs = await store("ash-hermes")
  if (!blobs) return []
  const raw = await blobs.get("events", { type: "json" })
  if (!raw || typeof raw !== "object") return []
  const rows = (raw as { events?: HermesEvent[] }).events
  return Array.isArray(rows) ? rows.slice(-80) : []
}

export async function writeHermesEvents(events: HermesEvent[]) {
  const blobs = await store("ash-hermes")
  if (!blobs) return false
  await blobs.setJSON("events", { events: events.slice(-80) })
  return true
}

export async function appendHermesEvent(event: HermesEvent) {
  const events = [...(await readHermesEvents()), event]
  await writeHermesEvents(events)
  return events
}

export async function readHermesHealth(): Promise<HermesHealth | null> {
  const blobs = await store("ash-hermes")
  if (!blobs) return null
  const raw = await blobs.get("health", { type: "json" })
  if (!raw || typeof raw !== "object") return null
  const row = raw as HermesHealth
  return row.status === "connected" || row.status === "disconnected" ? row : null
}

export async function writeHermesHealth(health: HermesHealth) {
  const blobs = await store("ash-hermes")
  if (!blobs) return false
  await blobs.setJSON("health", health)
  return true
}

export async function writeHermesImage(id: string, image: HermesImageBlob) {
  const blobs = await store("ash-hermes")
  if (!blobs || !id.startsWith("img-")) return false
  await blobs.setJSON(id, image)
  return true
}

export async function readInquiryState(): Promise<InquiryState> {
  const blobs = await store("ash-hermes")
  if (!blobs) return emptyInquiry()
  const raw = await blobs.get("inquiry", { type: "json" })
  return hydrateInquiryState(raw)
}

export async function writeInquiryState(inquiry: InquiryState) {
  const blobs = await store("ash-hermes")
  if (!blobs) return false
  await blobs.setJSON("inquiry", inquiry)
  return true
}

export async function readHermesImage(id: string): Promise<HermesImageBlob | null> {
  const blobs = await store("ash-hermes")
  if (!blobs || !id.startsWith("img-")) return null
  const raw = await blobs.get(id, { type: "json" })
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<HermesImageBlob>
  if (typeof row.mime !== "string" || typeof row.data !== "string") return null
  return { mime: row.mime, name: typeof row.name === "string" ? row.name : "image", data: row.data }
}
