import { emptyInquiry, hydrateInquiryState, type InquiryState } from "./inquiryDesk"
import {
  emptyLedger,
  emptyMemory,
  hydrateLedger,
  type HermesCase,
  type HermesCoachTurn,
  type HermesEvent,
  type HermesLedger,
  type HermesMemory,
} from "./hermesDesk"

export const LOCAL_HERMES_DESK_FILENAME = "local-hermes-desk.json"

export type LocalHermesLead = {
  id: string
  source?: string
  contact?: string
  email?: string
  name?: string
  org?: string
  note?: string
  at?: string
}

export type LocalHermesDeskState = {
  cases: HermesCase[]
  coach: HermesCoachTurn[]
  events: HermesEvent[]
  memory: HermesMemory
  health: { status: "connected" | "disconnected"; checkedAt: string; model?: string; detail?: string } | null
  inquiry: InquiryState
  ledger: HermesLedger
  sessions: Record<string, unknown>
  ipVisitors: Record<string, { visitorId: string; at: string }>
  leads: LocalHermesLead[]
}

export function emptyLocalHermesDesk(): LocalHermesDeskState {
  return {
    cases: [],
    coach: [],
    events: [],
    memory: emptyMemory(),
    health: null,
    inquiry: emptyInquiry(),
    ledger: emptyLedger(),
    sessions: {},
    ipVisitors: {},
    leads: [],
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

export function hydrateLocalHermesDesk(raw: unknown): LocalHermesDeskState {
  const base = emptyLocalHermesDesk()
  const row = asRecord(raw)
  if (!row) return base
  const health = asRecord(row.health)
  const sessions = asRecord(row.sessions) || {}
  const ipVisitors: LocalHermesDeskState["ipVisitors"] = {}
  const ipRaw = asRecord(row.ipVisitors) || {}
  for (const [key, value] of Object.entries(ipRaw)) {
    const item = asRecord(value)
    if (!item || typeof item.visitorId !== "string" || !item.visitorId.trim()) continue
    ipVisitors[key] = { visitorId: item.visitorId.trim().slice(0, 80), at: typeof item.at === "string" ? item.at : "" }
  }
  return {
    cases: Array.isArray(row.cases)
      ? row.cases.filter((item): item is HermesCase => Boolean(asRecord(item)?.id))
      : [],
    coach: Array.isArray(row.coach) ? (row.coach as HermesCoachTurn[]) : [],
    events: Array.isArray(row.events) ? (row.events as HermesEvent[]) : [],
    memory: {
      shared: typeof asRecord(row.memory)?.shared === "string" ? String(asRecord(row.memory)?.shared) : base.memory.shared,
      desk: typeof asRecord(row.memory)?.desk === "string" ? String(asRecord(row.memory)?.desk) : base.memory.desk,
      updatedAt: typeof asRecord(row.memory)?.updatedAt === "string" ? String(asRecord(row.memory)?.updatedAt) : "",
    },
    health:
      health && (health.status === "connected" || health.status === "disconnected")
        ? {
            status: health.status,
            checkedAt: typeof health.checkedAt === "string" ? health.checkedAt : "",
            model: typeof health.model === "string" ? health.model : undefined,
            detail: typeof health.detail === "string" ? health.detail : undefined,
          }
        : null,
    inquiry: hydrateInquiryState(row.inquiry),
    ledger: hydrateLedger(row.ledger),
    sessions,
    ipVisitors,
    leads: Array.isArray(row.leads)
      ? row.leads.filter((item): item is LocalHermesLead => typeof asRecord(item)?.id === "string")
      : [],
  }
}

export function parseLocalHermesDesk(text: string): LocalHermesDeskState {
  try {
    return hydrateLocalHermesDesk(JSON.parse(text) as unknown)
  } catch {
    return emptyLocalHermesDesk()
  }
}

export function serializeLocalHermesDesk(state: LocalHermesDeskState) {
  return JSON.stringify(state, null, 2)
}
