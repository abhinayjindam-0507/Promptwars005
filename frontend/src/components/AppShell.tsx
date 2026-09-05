import { Menu, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { NavId } from '../types'
import { BrandMark } from './BrandMark'
import { DisclaimerFooter } from './DisclaimerFooter'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  activeNav: NavId
  onNavigate: (id: NavId) => void
  children: ReactNode
}

export function AppShell({ activeNav, onNavigate, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleNavigate(id: NavId) {
    onNavigate(id)
    setMobileOpen(false)
  }

  return (
    <div className="flex min-h-svh bg-paper">
      <div className="hidden lg:block">
        <div className="sticky top-0 h-svh">
          <Sidebar activeNav={activeNav} onNavigate={handleNavigate} />
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full w-[248px] shadow-2xl">
            <Sidebar activeNav={activeNav} onNavigate={handleNavigate} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface/80 px-4 py-3 backdrop-blur lg:hidden">
          <BrandMark compact tone="light" />
          <button
            type="button"
            className="rounded-md border border-line p-2 text-ink"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </header>

        <main className="paper-grid flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1120px]">{children}</div>
        </main>

        <DisclaimerFooter />
      </div>
    </div>
  )
}
