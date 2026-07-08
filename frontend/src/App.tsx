import { useEffect, useMemo, useRef } from 'react'
import { AppShell } from './components/AppShell'
import { AuthGate } from './features/auth/AuthGate'
import { BacklogPage } from './features/backlog/BacklogPage'
import { HabitsPage } from './features/habits/HabitsPage'
import { HistoryPage } from './features/history/HistoryPage'
import { MetricsPage } from './features/metrics/MetricsPage'
import { TodayPage } from './features/today/TodayPage'
import { useDayRollover } from './hooks/useDayRollover'
import { useNumberWheelBlock } from './hooks/useNumberWheelBlock'
import { useUnloadFlush } from './hooks/useUnloadFlush'
import { computeMetrics } from './lib/engine/metrics'
import { parseImportedSnapshot } from './lib/engine/validate'
import { useAppStore } from './store/useAppStore'

function AuthedApp() {
  useDayRollover()
  useUnloadFlush()

  const activeTab = useAppStore((s) => s.ui.activeTab)
  const data = useAppStore((s) => s.data)
  const today = useAppStore((s) => s.ui.today)
  const importSnapshot = useAppStore((s) => s.importSnapshot)

  const streak = useMemo(() => computeMetrics(data, today).streak, [data, today])

  const fileInput = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `momentum-${data.username || 'profile'}-${today}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (file: File) => {
    const name = data.username || 'this profile'
    try {
      const snapshot = parseImportedSnapshot(JSON.parse(await file.text()))
      if (!confirm(`Import "${file.name}"? This replaces ${name}'s current data.`)) return
      importSnapshot(snapshot)
      alert('Import complete.')
    } catch {
      alert("That file isn't a valid Momentum export.")
    }
  }

  return (
    <AppShell
      streak={streak}
      onExport={handleExport}
      onImport={() => fileInput.current?.click()}
    >
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImportFile(file)
          e.target.value = '' // allow re-importing the same file (v1 parity)
        }}
      />

      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'today' && <TodayPage />}
        {activeTab === 'backlog' && <BacklogPage />}
        {activeTab === 'habits' && <HabitsPage />}
        {activeTab === 'history' && <HistoryPage />}
        {activeTab === 'metrics' && <MetricsPage />}
      </div>
    </AppShell>
  )
}

export default function App() {
  useNumberWheelBlock()

  const checkAuth = useAppStore((s) => s.checkAuth)

  // Resolve session.status on boot.
  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  return (
    <AuthGate>
      <AuthedApp />
    </AuthGate>
  )
}
