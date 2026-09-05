import { demoPatient } from '../data/mockData'
import { DemoBadge } from './DemoBadge'
import { StatusBadge } from './StatusBadge'

const fields = [
  { label: 'Patient code', value: demoPatient.code },
  { label: 'Age', value: String(demoPatient.age) },
  { label: 'Sex', value: demoPatient.sex },
  { label: 'Latest report date', value: demoPatient.latestReportDate },
  { label: 'Lab results', value: String(demoPatient.labResultCount) },
] as const

export function PatientOverview() {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Patient overview</h2>
          <p className="mt-1 text-[12.5px] text-slate-body">
            Preview of a synthetic record in the demo workspace.
          </p>
        </div>
        <DemoBadge />
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.label}
            className="rounded-lg border border-line bg-paper/70 px-3 py-2.5"
          >
            <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-body">
              {field.label}
            </dt>
            <dd className="mt-1 text-[14px] font-medium text-ink">{field.value}</dd>
          </div>
        ))}
        <div className="rounded-lg border border-line bg-paper/70 px-3 py-2.5 sm:col-span-2">
          <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-body">
            Verification status
          </dt>
          <dd className="mt-2">
            <StatusBadge status={demoPatient.verificationStatus} />
          </dd>
        </div>
      </dl>
    </section>
  )
}
