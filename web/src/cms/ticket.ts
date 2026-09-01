/**
 * Ticket protocol for the sales advisor: the model appends
 * <ticket>{"name":"","org":"","contact":"","note":""}</ticket>
 * when the customer leaves a reachable contact. The server parses it,
 * files a lead for the back office, and strips the marker from the reply.
 */

export type TicketDraft = {
  name: string
  org: string
  contact: string
  note: string
}

const TICKET_RE = /<ticket>([\s\S]*?)<\/ticket>/i
const TICKET_TAG_RE = /<\/?ticket>/gi

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

/** Remove ticket markers from untrusted text (user input, fallback paths). */
export function stripTicketTags(text: string): string {
  return text.replace(TICKET_RE, "").replace(TICKET_TAG_RE, "").trim()
}

/** Pull a ticket out of a model reply; always returns the display-safe reply. */
export function extractTicket(reply: string): { reply: string; ticket: TicketDraft | null } {
  const match = reply.match(TICKET_RE)
  const cleanedReply = stripTicketTags(reply)
  if (!match) return { reply: cleanedReply, ticket: null }
  try {
    const raw = JSON.parse(match[1]) as Record<string, unknown>
    const ticket: TicketDraft = {
      name: clean(raw.name, 120),
      org: clean(raw.org, 200),
      contact: clean(raw.contact, 200),
      note: clean(raw.note, 2000),
    }
    if (ticket.contact.length < 5 || !ticket.note) return { reply: cleanedReply, ticket: null }
    return { reply: cleanedReply, ticket }
  } catch {
    return { reply: cleanedReply, ticket: null }
  }
}
