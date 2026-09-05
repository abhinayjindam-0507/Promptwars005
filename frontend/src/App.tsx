import { useState } from 'react'
import { AppShell } from './components/AppShell'
import { Dashboard } from './pages/Dashboard'
import { PlaceholderView } from './pages/PlaceholderView'
import type { NavId } from './types'

export default function App() {
  const [activeNav, setActiveNav] = useState<NavId>('dashboard')

  return (
    <AppShell activeNav={activeNav} onNavigate={setActiveNav}>
      {activeNav === 'dashboard' ? (
        <Dashboard />
      ) : (
        <PlaceholderView navId={activeNav} />
      )}
    </AppShell>
  )
}
