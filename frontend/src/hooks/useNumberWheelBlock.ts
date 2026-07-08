import { useEffect } from 'react'

/**
 * Time (number) inputs must never change on mouse-wheel while focused - only
 * by typing. Document-level so it also covers dynamically added fields
 * (port of the v1 init() wheel guard). Mount once, in App.
 */
export function useNumberWheelBlock(): void {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const t = e.target
      if (
        t instanceof HTMLInputElement &&
        t.type === 'number' &&
        document.activeElement === t
      ) {
        e.preventDefault()
      }
    }
    document.addEventListener('wheel', onWheel, { passive: false })
    return () => document.removeEventListener('wheel', onWheel)
  }, [])
}
