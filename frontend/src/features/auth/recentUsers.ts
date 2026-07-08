/**
 * Recent-profile pills on the login card. Stored as a JSON string[] under
 * 'momentum.recentUsers', most recent first, max 5. Integration also calls
 * rememberUser() after a successful session restore.
 */

const KEY = 'momentum.recentUsers'
const MAX = 5

export function getRecentUsers(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((u): u is string => typeof u === 'string').slice(0, MAX)
  } catch {
    return []
  }
}

export function rememberUser(name: string): void {
  const next = [name, ...getRecentUsers().filter((u) => u !== name)].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable (private mode/quota) - pills just won't persist */
  }
}
