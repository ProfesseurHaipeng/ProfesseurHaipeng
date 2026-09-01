/** Contact-form leads shared between the site, the API, and the admin desk. */

export type Lead = {
  id: string
  at: string
  name: string
  org: string
  email: string
  note: string
  place?: string
}

export type LeadInput = Pick<Lead, "name" | "org" | "email" | "note">

const MAX_FIELD = 200
const MAX_NOTE = 2000

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

/** Validate one submission; null means it is not worth storing. */
export function sanitizeLead(raw: unknown): LeadInput | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const name = clean(row.name, MAX_FIELD)
  const org = clean(row.org, MAX_FIELD)
  const email = clean(row.email, MAX_FIELD)
  const note = typeof row.note === "string" ? row.note.trim().slice(0, MAX_NOTE) : ""
  if (!name || !note) return null
  if (!email || !email.includes("@")) return null
  return { name, org, email, note }
}

export function newLeadId(now = Date.now()): string {
  return `lead-${String(now).padStart(15, "0")}-${Math.random().toString(36).slice(2, 8)}`
}

/** Newest first; ids embed a zero-padded timestamp so key order works too. */
export function sortLeads(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}
