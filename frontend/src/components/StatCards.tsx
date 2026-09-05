import { AlertCircle, FileCheck2, Timer, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { workspaceStats } from '../data/mockData'

const icons: Record<string, LucideIcon> = {
  patients: Users,
  reports: FileCheck2,
  pending: Timer,
  conflicts: AlertCircle,
}

export function StatCards() {
  return (
    <section aria-label="Workspace statistics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {workspaceStats.map((stat) => {
          const Icon = icons[stat.id] ?? Users
          return (
            <article
              key={stat.id}
              className="rounded-xl border border-line bg-surface px-4 py-4 shadow-[0_1px_0_rgb(16_28_26_/_0.03)]"
            >
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-body">
                  {stat.label}
                </p>
                <Icon size={16} strokeWidth={1.6} className="text-teal" />
              </div>
              <p className="mt-3 font-display text-[32px] leading-none tracking-tight text-ink">
                {stat.value}
              </p>
              <p className="mt-2 text-[12px] leading-snug text-slate-body">
                {stat.hint}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
