import { AlertCircle, FileCheck2, Timer, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { workspaceStats } from '../data/mockData'

const icons: Record<string, LucideIcon> = {
  patients: Users,
  reports: FileCheck2,
  pending: Timer,
  conflicts: AlertCircle,
}

interface StatCardsProps {
  isLive?: boolean
  patientCount?: number
  reportCount?: number
}

export function StatCards({
  isLive = false,
  patientCount,
  reportCount,
}: StatCardsProps) {
  const stats = isLive
    ? [
        {
          id: 'patients',
          label: 'Patients',
          value: patientCount ?? 0,
          hint: 'Registered in database',
        },
        {
          id: 'reports',
          label: 'Reports on Record',
          value: reportCount ?? 0,
          hint: 'Documents indexed for patient',
        },
        {
          id: 'pending',
          label: 'Pending Verification',
          value: reportCount ? 'In Queue' : 0,
          hint: 'Awaiting human review',
        },
        {
          id: 'conflicts',
          label: 'Conflicts Detected',
          value: 0,
          hint: 'No clinical discrepancies detected',
        },
      ]
    : workspaceStats

  return (
    <section aria-label="Workspace statistics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
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
