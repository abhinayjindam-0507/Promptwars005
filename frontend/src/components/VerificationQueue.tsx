import { verificationQueue } from '../data/mockData'
import { DemoBadge } from './DemoBadge'
import { StatusBadge } from './StatusBadge'

export function VerificationQueue() {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Verification queue</h2>
          <p className="mt-1 text-[12.5px] text-slate-body">
            Items waiting for source-backed human review.
          </p>
        </div>
        <DemoBadge />
      </div>

      <ul className="mt-4 space-y-3">
        {verificationQueue.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-line bg-paper/60 px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-medium text-ink">{item.patientCode}</p>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-body">
              {item.summary}
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-slate-body">
              {item.reason} · {item.queuedAt}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
