import type { ReactNode } from 'react'
import { Header } from './Header'
import { TabBar } from './TabBar'

export interface AppShellProps {
  streak: number
  onExport?: () => void
  onImport?: () => void
  children: ReactNode
}

/**
 * The authed frame: centered max-w-5xl column with the header on top.
 * Tabs sit below the header on md+ and in a fixed bottom bar (with
 * safe-area padding) on smaller screens.
 */
export function AppShell({ streak, onExport, onImport, children }: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-20 sm:px-6 md:pb-8">
      <Header streak={streak} onExport={onExport} onImport={onImport} />

      <div className="hidden md:block">
        <TabBar variant="top" />
        <hr className="tick-rule" />
      </div>

      <main className="flex-1 pt-4">{children}</main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-face pb-[env(safe-area-inset-bottom)] md:hidden">
        <TabBar variant="bottom" />
      </div>
    </div>
  )
}
