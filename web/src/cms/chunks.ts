/** Split one long reply into short bubbles delivered one after another. */

const MAX_CHUNKS = 4
const LONG_PARAGRAPH = 170

function splitSentences(text: string): string[] {
  const out: string[] = []
  let buffer = ""
  for (const ch of text) {
    buffer += ch
    if ("。！？!?".includes(ch)) {
      out.push(buffer.trim())
      buffer = ""
    }
  }
  if (buffer.trim()) out.push(buffer.trim())
  return out.filter(Boolean)
}

function splitLongParagraph(paragraph: string): string[] {
  const sentences = splitSentences(paragraph)
  if (sentences.length <= 1) return [paragraph]
  const chunks: string[] = []
  let buffer = ""
  for (const sentence of sentences) {
    if (buffer && buffer.length + sentence.length > 130) {
      chunks.push(buffer)
      buffer = sentence
    } else {
      buffer = buffer ? `${buffer}${sentence}` : sentence
    }
  }
  if (buffer) chunks.push(buffer)
  return chunks
}

export function splitReplyIntoChunks(reply: string): string[] {
  const trimmed = reply.trim()
  if (!trimmed) return []
  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)

  const chunks: string[] = []
  for (const paragraph of paragraphs) {
    // Keep lists and multi-line blocks whole so bullets stay together.
    if (paragraph.length <= LONG_PARAGRAPH || paragraph.includes("\n")) {
      chunks.push(paragraph)
    } else {
      chunks.push(...splitLongParagraph(paragraph))
    }
  }

  if (chunks.length > MAX_CHUNKS) {
    return [...chunks.slice(0, MAX_CHUNKS - 1), chunks.slice(MAX_CHUNKS - 1).join("\n\n")]
  }
  return chunks
}

/** How long the "typing" dots show before a chunk lands. */
export function typingDelayFor(chunk: string): number {
  return Math.round(Math.min(1500, 380 + chunk.length * 13))
}

/** Small pause after a bubble lands before the next one starts typing. */
export const CHUNK_GAP_MS = 240
