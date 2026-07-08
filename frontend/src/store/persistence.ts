/**
 * SaveScheduler - the debounced persistence pipeline, v1 semantics preserved:
 * every mutation calls markDirty(); 400ms after the last one the snapshot is
 * PUT to the server; the save-status chip mirrors progress; a pending save is
 * flushed with fetch keepalive when the page hides (sendBeacon can't carry
 * the Authorization header, keepalive can).
 *
 * Concurrency: the server does a version compare-and-swap. On 409 the
 * scheduler hands the winning doc to onConflict (the store adopts it).
 */
import { ApiError } from '../api/client'
import { saveData, type ConflictBody } from '../api/data'
import type { SaveStatus, Snapshot } from '../types/domain'

export const SAVE_DEBOUNCE_MS = 400
export const SAVED_FLASH_MS = 1500
/** Browsers cap fetch-keepalive bodies at ~64 KiB; beyond that the fetch
 * rejects instantly and the unload save is silently lost. */
export const KEEPALIVE_MAX_BYTES = 60_000

export interface SaveSchedulerHooks {
  /** Current snapshot to persist (called at flush time, not schedule time). */
  getSnapshot(): Snapshot
  /** Server version the client last loaded/saved. */
  getVersion(): number
  setVersion(version: number): void
  setStatus(status: SaveStatus): void
  /** A 409: another tab/device won. The store should adopt the winning doc. */
  onConflict(winning: ConflictBody): void
  /** A 401: the session died server-side; retrying the same token is futile. */
  onAuthExpired?(): void
}

export class SaveScheduler {
  private hooks: SaveSchedulerHooks
  private timer: ReturnType<typeof setTimeout> | null = null
  private savedTimer: ReturnType<typeof setTimeout> | null = null
  private inflight: Promise<void> | null = null
  private dirty = false

  constructor(hooks: SaveSchedulerHooks) {
    this.hooks = hooks
  }

  /** Debounced save; restarts the 400ms window on every call (v1 behavior). */
  markDirty(): void {
    this.dirty = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flushNow(), SAVE_DEBOUNCE_MS)
  }

  /** Immediate save. Reused by the retry button, logout, and pagehide. */
  async flushNow(opts: { keepalive?: boolean } = {}): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    // Serialize saves: a flush during an in-flight save waits for it first
    // so version echoes stay ordered.
    if (this.inflight) {
      await this.inflight.catch(() => {})
      if (!this.dirty) return
    }
    if (!this.dirty) return
    this.dirty = false

    if (this.savedTimer) {
      clearTimeout(this.savedTimer)
      this.savedTimer = null
    }
    this.hooks.setStatus('saving')

    this.inflight = (async () => {
      try {
        const snapshot = this.hooks.getSnapshot()
        // Over the keepalive quota a keepalive fetch rejects outright; a
        // plain fetch at pagehide usually still completes, so prefer that.
        const keepalive =
          opts.keepalive && JSON.stringify(snapshot).length <= KEEPALIVE_MAX_BYTES
        const res = await saveData(this.hooks.getVersion(), snapshot, { keepalive })
        this.hooks.setVersion(res.version)
        this.hooks.setStatus('saved')
        this.savedTimer = setTimeout(() => this.hooks.setStatus('idle'), SAVED_FLASH_MS)
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          this.hooks.onConflict(err.body as ConflictBody)
          this.hooks.setStatus('idle')
          return
        }
        this.dirty = true // keep the change; the retry button re-flushes
        this.hooks.setStatus('error')
        if (err instanceof ApiError && err.status === 401) {
          this.hooks.onAuthExpired?.()
        }
      }
    })()
    try {
      await this.inflight
    } finally {
      this.inflight = null
    }
  }

  /** Whether an unsaved change is pending (used by the pagehide flush). */
  hasPending(): boolean {
    return this.dirty
  }

  /** Cancel timers (logout/unmount). Does not save. */
  dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    if (this.savedTimer) clearTimeout(this.savedTimer)
    this.timer = null
    this.savedTimer = null
  }
}
