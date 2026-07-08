/**
 * Unique-enough id generator, ported verbatim from v1 (legacy/app.js uid()).
 * Random base36 chunk + timestamp base36. Not cryptographic - ids only need
 * to be unique within one user's snapshot.
 */
export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
