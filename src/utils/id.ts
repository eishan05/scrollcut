let seq = 0

/**
 * Generates an ID in both secure and insecure contexts.
 *
 * On Android over LAN dev (`http://<ip>:5173`), `crypto.randomUUID()` can be
 * unavailable because it's not a secure context. Use a simple fallback so basic
 * flows (create project, import, split) keep working.
 */
export function newId(prefix = 'id'): string {
  const c = globalThis.crypto as undefined | { randomUUID?: () => string }
  if (c?.randomUUID) return c.randomUUID()

  // Not cryptographically strong; good enough for local/dev IDs.
  seq = (seq + 1) % 1_000_000
  const rand = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36)
  return `${prefix}_${time}_${seq.toString(36)}_${rand}`
}

