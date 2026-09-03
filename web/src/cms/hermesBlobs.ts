import { sortHermesCases, type HermesCase, type HermesCoachTurn } from "./hermesDesk"

type BlobStore = {
  get: (key: string, options: { type: "json" }) => Promise<unknown>
  setJSON: (key: string, value: unknown) => Promise<void>
  list: () => Promise<{ blobs: { key: string }[] }>
}

async function store(name: string): Promise<BlobStore | null> {
  try {
    const { getStore } = await import("@netlify/blobs")
    return getStore(name) as unknown as BlobStore
  } catch {
    return null
  }
}

export async function readHermesCases(): Promise<HermesCase[]> {
  const blobs = await store("ash-hermes")
  if (!blobs) return []
  const { blobs: keys } = await blobs.list()
  const rows = await Promise.all(
    keys
      .filter((item) => item.key.startsWith("case-"))
      .map(async ({ key }) => {
        const value = await blobs.get(key, { type: "json" })
        return value && typeof value === "object" ? (value as HermesCase) : null
      }),
  )
  return sortHermesCases(rows.filter((item): item is HermesCase => Boolean(item?.id)))
}

export async function writeHermesCase(item: HermesCase) {
  const blobs = await store("ash-hermes")
  if (!blobs) return false
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
