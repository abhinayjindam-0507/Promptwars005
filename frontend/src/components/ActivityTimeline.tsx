import { activityEvents } from '../data/mockData'
import { DemoBadge } from './DemoBadge'

export function ActivityTimeline() {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Recent activity</h2>
          <p className="mt-1 text-[12.5px] text-slate-body">
            A synthetic timeline of indexing and review events.
          </p>
        </div>
        <DemoBadge />
      </div>

      <ol className="relative mt-5 space-y-4 border-l border-line pl-5">
        {activityEvents.map((event) => (
          <li key={event.id} className="relative">
            <span className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full border border-teal bg-teal-mist" />
            <p className="text-[13.5px] font-medium text-ink">{event.title}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-body">
              {event.detail}
            </p>
            <p className="mt-1 text-[11px] text-slate-body">{event.occurredAt}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
