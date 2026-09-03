export function cloneJson<T>(value: T): T {
  return structuredClone(value)
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}
