/**
 * The header's account control: an avatar button that opens a small menu with
 * the signed-in name and clearly labelled actions (Export / Import / Log out).
 * Replaces three bare icon buttons with one self-explanatory menu.
 *
 * Accessibility: trigger has aria-haspopup/aria-expanded; the panel is a
 * role="menu" of role="menuitem" buttons. Opens focus the first item; Escape
 * closes and restores focus to the trigger; Arrow keys move between items;
 * an outside click closes it.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, DownloadIcon, LogoutIcon, UploadIcon } from '../features/today/icons'

export interface AccountMenuProps {
  /** Display name (already capitalised); '' when unknown. */
  name: string
  onExport?: () => void
  onImport?: () => void
  onLogout: () => void
}

export function AccountMenu({ name, onExport, onImport, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const initial = (name || '?').charAt(0).toUpperCase()
  const label = name ? `Account menu for ${name}` : 'Account menu'

  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  // Close on any click outside the menu.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Focus the first item when the menu opens.
  useEffect(() => {
    if (!open) return
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')
    first?.focus()
  }, [open])

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [],
    )
    if (items.length === 0) return
    const idx = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length
    items[next]?.focus()
  }

  const run = (fn?: () => void) => () => {
    close(false)
    fn?.()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 items-center gap-1 rounded-full border bg-face pl-0.5 pr-1.5 transition-colors duration-150 ease-click ${
          open ? 'border-accent text-accent-text' : 'border-line text-ink hover:border-accent hover:text-accent-text'
        }`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full font-display text-xs font-semibold">
          {initial}
        </span>
        <ChevronDownIcon className={`h-3 w-3 transition-transform duration-150 ease-click ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-40 mt-2 w-56 rounded-card border border-line bg-face p-1 shadow-overlay"
        >
          {name && (
            <div className="border-b border-line px-3 py-2">
              <div className="label-caps font-display text-[10px] text-muted">Signed in as</div>
              <div className="truncate font-display text-sm font-semibold text-ink">{name}</div>
            </div>
          )}
          <div className="py-1">
            <MenuItem icon={<DownloadIcon className="h-4 w-4" />} onClick={run(onExport)} disabled={!onExport}>
              Export data
            </MenuItem>
            <MenuItem icon={<UploadIcon className="h-4 w-4" />} onClick={run(onImport)} disabled={!onImport}>
              Import data
            </MenuItem>
            <MenuItem icon={<LogoutIcon className="h-4 w-4" />} onClick={run(onLogout)} danger>
              Log out
            </MenuItem>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon,
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 rounded-btn px-3 py-2 text-left text-sm transition-colors duration-150 ease-click disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? 'text-ink hover:bg-alert/10 hover:text-alert-text' : 'text-ink hover:bg-dial'
      }`}
    >
      <span className="shrink-0 text-muted">{icon}</span>
      {children}
    </button>
  )
}
