/**
 * Live day-rollover watcher (v1 startDayWatcher parity): a timer fires ~2s
 * past the next 3am boundary and reschedules; visibility/focus re-checks
 * catch a machine that slept across the boundary.
 */
import { useEffect } from 'react'
import { nextRolloverDelay } from '../lib/engine/dates'
import { useAppStore } from '../store/useAppStore'

export function useDayRollover(): void {
  const checkDayRollover = useAppStore((s) => s.checkDayRollover)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const schedule = () => {
      timer = setTimeout(() => {
        checkDayRollover()
        schedule()
      }, nextRolloverDelay(new Date()))
    }
    schedule()

    const onVisible = () => {
      if (!document.hidden) checkDayRollover()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', checkDayRollover)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', checkDayRollover)
    }
  }, [checkDayRollover])
}
