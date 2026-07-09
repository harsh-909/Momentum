import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { Tab } from '../types/domain'
import { useAppStore } from '../store/useAppStore'

/* Thin-stroke 16px instrument icons, drawn inline (no emoji). */
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" {...STROKE}>
      {children}
    </svg>
  )
}

const ICONS: Record<Tab, ReactNode> = {
  // sun
  today: (
    <Icon>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
    </Icon>
  ),
  // inbox tray
  backlog: (
    <Icon>
      <path d="M2.5 8.7 4.1 3.3h7.8l1.6 5.4v3.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
      <path d="M2.5 8.7h3.1l.9 1.7h3l.9-1.7h3.1" />
    </Icon>
  ),
  // repeat loop
  habits: (
    <Icon>
      <path d="M12.8 5.2A5.4 5.4 0 0 0 3.2 6.4" />
      <path d="M12.8 2.4v2.8h-2.8" />
      <path d="M3.2 10.8a5.4 5.4 0 0 0 9.6-1.2" />
      <path d="M3.2 13.6v-2.8H6" />
    </Icon>
  ),
  // calendar
  plans: (
    <Icon>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" />
    </Icon>
  ),
  // notebook
  history: (
    <Icon>
      <path d="M3.2 3.8A1.8 1.8 0 0 1 5 2h7.8v10.4H5a1.8 1.8 0 0 0-1.8 1.8z" />
      <path d="M3.2 14A1.8 1.8 0 0 1 5 12.4h7.8" />
    </Icon>
  ),
  // trend line over axes
  metrics: (
    <Icon>
      <path d="M2.5 2.5v11h11" />
      <path d="M4.8 10.5l2.7-3.1 2 1.9 3.4-4.2" />
    </Icon>
  ),
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'habits', label: 'Habits' },
  { id: 'plans', label: 'Plans' },
  { id: 'history', label: 'History' },
  { id: 'metrics', label: 'Metrics' },
]

export interface TabBarProps {
  /** `top` sits below the header (md+); `bottom` is the fixed mobile bar. */
  variant: 'top' | 'bottom'
}

export function TabBar({ variant }: TabBarProps) {
  const activeTab = useAppStore((s) => s.ui.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const select = (index: number) => {
    setActiveTab(TABS[index].id)
    refs.current[index]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const current = TABS.findIndex((t) => t.id === activeTab)
    let next = -1
    if (e.key === 'ArrowRight') next = (current + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (current - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next >= 0) {
      e.preventDefault()
      select(next)
    }
  }

  const isTop = variant === 'top'
  return (
    <nav
      role="tablist"
      aria-label="Sections"
      onKeyDown={onKeyDown}
      className={isTop ? 'flex items-end gap-1' : 'flex justify-around'}
    >
      {TABS.map((tab, i) => {
        const active = tab.id === activeTab
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => select(i)}
            className={`relative flex items-center transition-colors duration-150 ease-click ${
              active ? 'text-ink' : 'text-muted hover:text-ink'
            } ${
              isTop
                ? 'gap-2 px-3 py-2.5'
                : 'min-w-0 flex-1 flex-col gap-1 px-1 pb-1.5 pt-2.5'
            }`}
          >
            {ICONS[tab.id]}
            <span
              className={
                isTop
                  ? 'hidden font-display text-xs label-caps sm:inline'
                  : 'font-display text-[10px] label-caps'
              }
            >
              {tab.label}
            </span>
            {/* Orange tick indicator for the active tab. */}
            <span
              aria-hidden="true"
              className={`absolute left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full transition-colors duration-150 ease-click ${
                active ? 'bg-accent' : 'bg-transparent'
              } ${isTop ? 'bottom-0' : 'top-0'}`}
            />
          </button>
        )
      })}
    </nav>
  )
}
