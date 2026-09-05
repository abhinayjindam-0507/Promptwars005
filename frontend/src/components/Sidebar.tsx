import {
  ClipboardCheck,
  Clock3,
  FileStack,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react'
import type { NavId } from '../types'
import { BrandMark } from './BrandMark'

const items: { id: NavId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'reports', label: 'Reports', icon: FileStack },
  { id: 'timeline', label: 'Timeline', icon: Clock3 },
  { id: 'verification', label: 'Verification', icon: ClipboardCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  activeNav: NavId
  onNavigate: (id: NavId) => void
}

export function Sidebar({ activeNav, onNavigate }: SidebarProps) {
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-white/5 bg-ink text-surface">
      <div className="px-5 pb-6 pt-6">
        <BrandMark />
      </div>

      <nav className="flex-1 px-3" aria-label="Primary">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-mist/45">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon
            const active = item.id === activeNav
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] transition-colors ${
                    active
                      ? 'bg-white/10 text-surface'
                      : 'text-teal-mist/70 hover:bg-white/5 hover:text-surface'
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.75}
                    className={active ? 'text-teal-mist' : 'opacity-80'}
                  />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-white/8 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-teal-mist/15 text-[11px] font-semibold tracking-wide text-teal-mist">
            AC
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-surface">A. Chen</p>
            <p className="truncate text-[11px] text-teal-mist/55">
              Reviewer · demo account
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
