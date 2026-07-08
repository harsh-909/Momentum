/**
 * Flush a pending debounced save when the page hides (tab close, navigate,
 * mobile background). Uses fetch keepalive - unlike sendBeacon it can carry
 * the Authorization header the API requires.
 */
import { useEffect } from 'react'
import { getScheduler } from '../store/useAppStore'

export function useUnloadFlush(): void {
  useEffect(() => {
    const flush = () => {
      const scheduler = getScheduler()
      if (scheduler.hasPending()) void scheduler.flushNow({ keepalive: true })
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])
}
