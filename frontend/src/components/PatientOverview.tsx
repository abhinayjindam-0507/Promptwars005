import { demoPatient } from '../data/mockData'
import { formatDisplayDate } from '../lib/labels'
import type { PatientDetailResponse, PatientResponse, ReportResponse } from '../types/api'
import { DemoBadge } from './DemoBadge'
import { StatusBadge } from './StatusBadge'

interface PatientOverviewProps {
  isLive?: boolean
  loading?: boolean
  patients?: PatientResponse[]
  selectedPatient?: PatientDetailResponse | null
  reports?: ReportResponse[]
  onSelectPatient?: (id: number) => void
}

const demoFields = [
  { label: 'Patient code', value: demoPatient.code },
  { label: 'Age', value: String(demoPatient.age) },
  { label: 'Sex', value: demoPatient.sex },
  { label: 'Latest report date', value: demoPatient.latestReportDate },
  { label: 'Lab results', value: String(demoPatient.labResultCount) },
] as const

export function PatientOverview({
  isLive = false,
  loading = false,
  patients,
  selectedPatient,
  reports,
  onSelectPatient,
}: PatientOverviewProps) {
  if (loading) {
    return (
      <section className="rounded-xl border border-line bg-surface p-5" aria-busy="true" aria-label="Loading patient overview">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Patient overview</h2>
            <p className="mt-1 text-[12.5px] text-slate-body">Loading clinical record from database...</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="h-16 animate-pulse rounded-lg border border-line bg-paper" />
          <div className="h-16 animate-pulse rounded-lg border border-line bg-paper" />
          <div className="h-16 animate-pulse rounded-lg border border-line bg-paper" />
          <div className="h-16 animate-pulse rounded-lg border border-line bg-paper" />
          <div className="h-16 animate-pulse rounded-lg border border-line bg-paper sm:col-span-2" />
        </div>
      </section>
    )
  }

  if (isLive && selectedPatient) {
    const latestDate =
      reports?.[0]?.report_date ||
      reports?.[0]?.uploaded_at ||
      selectedPatient.reports?.[0]?.report_date ||
      selectedPatient.reports?.[0]?.uploaded_at

    const liveFields = [
      { label: 'Patient code', value: selectedPatient.patient_code },
      { label: 'Patient name', value: selectedPatient.name },
      { label: 'Age', value: selectedPatient.age != null ? String(selectedPatient.age) : '—' },
      { label: 'Sex', value: selectedPatient.sex || '—' },
      { label: 'Latest report date', value: formatDisplayDate(latestDate) },
      {
        label: 'Documents on record',
        value: reports ? `${reports.length} report(s)` : '0 reports',
      },
    ]

    return (
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Patient overview</h2>
            <p className="mt-1 text-[12.5px] text-slate-body">
              Live clinical record from backend database.
            </p>
          </div>
          <span className="inline-flex items-center rounded-sm border border-teal/30 bg-teal-mist px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
            Live Data
          </span>
        </div>

        {patients && patients.length > 1 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper/50 px-3 py-2">
            <label htmlFor="patient-select" className="text-[11.5px] font-medium text-slate-body">
              Active Patient:
            </label>
            <select
              id="patient-select"
              value={selectedPatient.id}
              onChange={(e) => onSelectPatient?.(Number(e.target.value))}
              className="rounded border border-line bg-surface px-2.5 py-1 text-[12.5px] font-medium text-ink focus:border-teal focus:outline-none"
              aria-label="Select active patient record"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patient_code} — {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {liveFields.map((field) => (
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

          {selectedPatient.symptoms ? (
            <div className="rounded-lg border border-line bg-paper/70 px-3 py-2.5 sm:col-span-2">
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-body">
                Symptoms / Presentation
              </dt>
              <dd className="mt-1 text-[13.5px] text-ink">{selectedPatient.symptoms}</dd>
            </div>
          ) : null}

          <div className="rounded-lg border border-line bg-paper/70 px-3 py-2.5 sm:col-span-2">
            <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-body">
              Verification status
            </dt>
            <dd className="mt-2 flex items-center gap-2">
              <StatusBadge status={reports && reports.length > 0 ? 'pending_review' : 'in_validation'} />
              <span className="text-[11.5px] text-slate-body">
                {reports && reports.length > 0
                  ? 'Documents indexed; pending human review.'
                  : 'Patient registered; awaiting report upload.'}
              </span>
            </dd>
          </div>
        </dl>
      </section>
    )
  }

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
        {demoFields.map((field) => (
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
