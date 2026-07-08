/**
 * Trust-boundary validation for the engine: imported files / server docs,
 * and the username rule shared verbatim with the backend.
 */
import { USERNAME_RE } from '../../types/domain'
import type { Snapshot } from '../../types/domain'
import { parseSnapshot } from '../../types/schemas'

/**
 * Parse an already-JSON-parsed unknown value (import file or server doc)
 * into a Snapshot. Delegates to the shared zod schema: legacy v1 fields
 * (addingSubtask etc.) are stripped, missing optionals defaulted. Throws
 * ZodError on structural mismatch.
 */
export function parseImportedSnapshot(raw: unknown): Snapshot {
  return parseSnapshot(raw)
}

/**
 * Normalize a username the same way v1 and the backend do: trim, lowercase,
 * then require `^[a-z0-9][a-z0-9_-]{0,31}$`. Returns '' when invalid - this
 * doubles as the path-traversal guard, so keep it in sync with the server.
 */
export function normalizeUsername(name: string): string {
  if (typeof name !== 'string') return ''
  const n = name.trim().toLowerCase()
  return USERNAME_RE.test(n) ? n : ''
}
