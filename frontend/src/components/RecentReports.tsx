import { recentReports } from '../data/mockData'
import { reportKindLabel } from '../lib/labels'
import { DemoBadge } from './DemoBadge'
import { StatusBadge } from './StatusBadge'

export function RecentReports() {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Recent reports</h2>
          <p className="mt-1 text-[12.5px] text-slate-body">
            Latest documents indexed in the demo workspace.
          </p>
        </div>
        <DemoBadge />
      </div>

      <ul className="mt-4 divide-y divide-line">
        {recentReports.map((report) => (
          <li key={report.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-ink">
                {report.title}
              </p>
              <p className="mt-0.5 text-[12px] text-slate-body">
                {report.patientCode} · {reportKindLabel(report.kind)} ·{' '}
                {report.receivedAt}
              </p>
            </div>
            <StatusBadge status={report.status} />
          </li>
        ))}
      </ul>
    </section>
  )
}
