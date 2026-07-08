/**
 * Instrument-flavored celebration: 20 thin tick-shaped slivers (2x8px) in
 * palette colors fall and rotate away from the origin element. Web Animations
 * API, <= 1.2s, DOM cleaned up afterwards. No-ops under reduced motion.
 */

const PIECES = 20
const MAX_DURATION_MS = 1200

export function celebrate(originEl: HTMLElement): void {
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return
  }

  const rect = originEl.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  const rootStyles = getComputedStyle(document.documentElement)
  const palette = ['--color-accent', '--color-good', '--color-ink', '--color-face'].map(
    (name) => rootStyles.getPropertyValue(name).trim() || '#e8590c',
  )

  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  container.style.cssText =
    'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:9999;'
  document.body.appendChild(container)

  let remaining = PIECES
  const done = () => {
    remaining -= 1
    if (remaining <= 0) container.remove()
  }

  for (let i = 0; i < PIECES; i++) {
    const piece = document.createElement('div')
    piece.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:2px;height:8px;border-radius:1px;background:${palette[i % palette.length]};`
    container.appendChild(piece)

    const drift = (Math.random() - 0.5) * 180 // sideways scatter
    const rise = 20 + Math.random() * 40 // initial pop upwards
    const fall = 80 + Math.random() * 120 // final drop below origin
    const spin = (Math.random() - 0.5) * 720
    const duration = 700 + Math.random() * (MAX_DURATION_MS - 700)

    const animation = piece.animate(
      [
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${drift * 0.5}px), calc(-50% - ${rise}px)) rotate(${spin * 0.4}deg)`,
          opacity: 1,
          offset: 0.3,
        },
        {
          transform: `translate(calc(-50% + ${drift}px), calc(-50% + ${fall}px)) rotate(${spin}deg)`,
          opacity: 0,
        },
      ],
      { duration, easing: 'cubic-bezier(0.3, 0.7, 0, 1)', fill: 'forwards' },
    )
    animation.onfinish = done
    animation.oncancel = done
  }

  // Safety net in case an animation never fires its finish event.
  window.setTimeout(() => container.remove(), MAX_DURATION_MS + 300)
}
