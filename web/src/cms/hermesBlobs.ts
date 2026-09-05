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
import {
  guideIpBlobKey,
  guideSessionBlobKey,
  hydrateGuideSession,
  type GuideSession,
} from "./guideSession"

type BlobStore = {
  get: (key: string, options: { type: "json"; consistency?: "strong" | "eventual" }) => Promise<unknown>
  setJSON: (key: string, value: unknown) => Promise<void>
  delete?: (key: string) => Promise<void>
  list: () => Promise<{ blobs: { key: string }[] }>
}

export type HermesImageBlob = { mime: string; name: string; data: string }

export const HERMES_CASES_SNAPSHOT_KEY = "cases"

async function store(name: string): Promise<BlobStore | null> {
  try {
    const { getStore } = await import("@netlify/blobs")
    return getStore({ name, consistency: "strong" }) as unknown as BlobStore
  } catch {
    return null
  }
}

async function hermesStore() {
  return store("ash-hermes")
}

function asCase(value: unknown): HermesCase | null {
  if (!value || typeof value !== "object") return null
  const row = value as HermesCase
  return row.id ? row : null
}

export function preferHermesCase(left: HermesCase, right: HermesCase) {
  const leftGone = Boolean(left.gone)
  const rightGone = Boolean(right.gone)
  if (leftGone !== rightGone) return leftGone ? left : right
  const leftAt = Date.parse(left.updatedAt || left.at || "") || 0
  const rightAt = Date.parse(right.updatedAt || right.at || "") || 0
  if (leftAt !== rightAt) return leftAt > rightAt ? left : right
  return right
}

export function mergeStoredCases(...parts: HermesCase[][]) {
  const byId = new Map<string, HermesCase>()
  for (const part of parts) {
    for (const item of part) {
      if (!item?.id) continue
      const prev = byId.get(item.id)
      byId.set(item.id, prev ? preferHermesCase(prev, item) : item)
    }
  }
  return [...byId.values()]
}

async function readCasesSnapshot(blobs: BlobStore): Promise<HermesCase[] | null> {
  const raw = await blobs.get(HERMES_CASES_SNAPSHOT_KEY, { type: "json", consistency: "strong" })
  if (!raw || typeof raw !== "object") return null
  const rows = (raw as { cases?: unknown }).cases
  if (!Array.isArray(rows)) return null
  return rows.map(asCase).filter((item): item is HermesCase => Boolean(item))
}

async function writeCasesSnapshot(blobs: BlobStore, cases: HermesCase[]) {
  await blobs.setJSON(HERMES_CASES_SNAPSHOT_KEY, { cases, updatedAt: new Date().toISOString() })
}

async function readListedCases(blobs: BlobStore): Promise<HermesCase[]> {
  const { blobs: keys } = await blobs.list()
  const rows = await Promise.all(
    keys
      .filter((item) => item.key.startsWith("case-"))
      .map(async ({ key }) => asCase(await blobs.get(key, { type: "json", consistency: "strong" }))),
  )
  return rows.filter((item): item is HermesCase => Boolean(item))
}

async function readAllCasesRaw(blobs: BlobStore): Promise<HermesCase[]> {
  const snapshot = await readCasesSnapshot(blobs)
  if (snapshot) return snapshot
  const listed = await readListedCases(blobs)
  if (listed.length) {
    try {
      await writeCasesSnapshot(blobs, listed)
    } catch {
      /* first read still returns the listed archive */
    }
  }
  return listed
}

export async function readHermesLedger(): Promise<HermesLedger> {
  const blobs = await hermesStore()
  if (!blobs) return emptyLedger()
  return hydrateLedger(await blobs.get("ledger", { type: "json", consistency: "strong" }))
}

export async function writeHermesLedger(ledger: HermesLedger) {
  const blobs = await hermesStore()
  if (!blobs) return false
  try {
    await blobs.setJSON("ledger", ledger)
    return true
  } catch {
    return false
  }
}

export async function readHermesCases(options: { includeGone?: boolean } = {}): Promise<HermesCase[]> {
  const blobs = await hermesStore()
  if (!blobs) return []
  const [all, ledger] = await Promise.all([readAllCasesRaw(blobs), readHermesLedger()])
  const sorted = sortHermesCases(all)
  return options.includeGone ? sorted : liveCases(sorted, ledger)
}

export async function writeHermesCase(item: HermesCase) {
  const blobs = await hermesStore()
  if (!blobs) return false
  try {
    const all = await readAllCasesRaw(blobs)
    const existing = all.find((row) => row.id === item.id) ?? null
    if (!item.gone) {
      const ledger = await readHermesLedger()
      if (!canWriteLiveHermesCase(item, existing, ledger)) return true
    }
    const next = mergeStoredCases(all, [item])
    await blobs.setJSON(item.id, item)
    await writeCasesSnapshot(blobs, next)
    return true
  } catch {
    return false
  }
}

export async function writeHermesCases(cases: HermesCase[]) {
  for (const item of cases) {
    const ok = await writeHermesCase(item)
    if (!ok) return false
  }
  return true
}

export async function persistDeletedCases(gone: HermesCase[], ledger: HermesLedger) {
  const blobs = await hermesStore()
  if (!blobs) return false
  try {
    await blobs.setJSON("ledger", ledger)
    if (!gone.length) return true
    const next = mergeStoredCases(await readAllCasesRaw(blobs), gone)
    await writeCasesSnapshot(blobs, next)
    for (const item of gone) await blobs.setJSON(item.id, item)
    return true
  } catch {
    return false
  }
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
  if (!id.startsWith("case-")) return false
  const blobs = await hermesStore()
  if (!blobs) return false
  try {
    const all = await readAllCasesRaw(blobs)
    const existing = all.find((item) => item.id === id)
    const row = { ...(existing || { id }), id, gone: true, updatedAt: new Date().toISOString() } as HermesCase
    const next = mergeStoredCases(all, [row])
    await blobs.setJSON(id, row)
    await writeCasesSnapshot(blobs, next)
    return true
  } catch {
    return false
  }
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

export async function readGuideChatSession(visitorId: string): Promise<GuideSession | null> {
  const key = guideSessionBlobKey(visitorId)
  const blobs = await store("ash-hermes")
  if (!blobs || !key) return null
  return hydrateGuideSession(await blobs.get(key, { type: "json" }), visitorId)
}

export async function writeGuideChatSession(session: GuideSession) {
  const next = hydrateGuideSession(session, session.visitorId)
  const key = next ? guideSessionBlobKey(next.visitorId) : ""
  const blobs = await store("ash-hermes")
  if (!blobs || !next || !key) return false
  await blobs.setJSON(key, next)
  return true
}

export async function readGuideIpVisitor(ipHash: string): Promise<{ visitorId: string; at: string } | null> {
  const key = guideIpBlobKey(ipHash)
  const blobs = await store("ash-hermes")
  if (!blobs || !key) return null
  const raw = await blobs.get(key, { type: "json" })
  if (!raw || typeof raw !== "object") return null
  const row = raw as { visitorId?: unknown; at?: unknown }
  if (typeof row.visitorId !== "string" || !row.visitorId.trim()) return null
  return { visitorId: row.visitorId.trim().slice(0, 80), at: typeof row.at === "string" ? row.at : "" }
}

export async function writeGuideIpVisitor(ipHash: string, visitorId: string) {
  const key = guideIpBlobKey(ipHash)
  const blobs = await store("ash-hermes")
  if (!blobs || !key || !visitorId.trim()) return false
  await blobs.setJSON(key, { visitorId: visitorId.trim().slice(0, 80), at: new Date().toISOString() })
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
