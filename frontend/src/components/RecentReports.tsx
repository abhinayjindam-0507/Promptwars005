import { recentReports } from '../data/mockData'
import {
  formatDisplayDate,
  mapProcessingStatusToVerification,
  reportKindLabel,
} from '../lib/labels'
import type { ReportResponse } from '../types/api'
import { DemoBadge } from './DemoBadge'
import { StatusBadge } from './StatusBadge'

interface RecentReportsProps {
  isLive?: boolean
  loading?: boolean
  patientCode?: string
  reports?: ReportResponse[]
}

export function RecentReports({
  isLive = false,
  loading = false,
  patientCode,
  reports,
}: RecentReportsProps = {}) {
  if (loading) {
    return (
      <section
        className="rounded-xl border border-line bg-surface p-5"
        aria-busy="true"
        aria-label="Loading recent reports"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Recent reports</h2>
            <p className="mt-1 text-[12.5px] text-slate-body">Loading document index...</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="h-14 animate-pulse rounded-lg border border-line bg-paper" />
          <div className="h-14 animate-pulse rounded-lg border border-line bg-paper" />
          <div className="h-14 animate-pulse rounded-lg border border-line bg-paper" />
        </div>
      </section>
    )
  }

  if (isLive) {
    return (
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Recent reports</h2>
            <p className="mt-1 text-[12.5px] text-slate-body">
              Latest documents indexed in the database.
            </p>
          </div>
          <span className="inline-flex items-center rounded-sm border border-teal/30 bg-teal-mist px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
            Live Data
          </span>
        </div>

        {reports && reports.length > 0 ? (
          <ul className="mt-4 divide-y divide-line">
            {reports.map((report) => (
              <li
                key={report.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-ink">
                    {report.file_name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-body">
                    {patientCode ? `${patientCode} · ` : ''}
                    {report.page_count != null ? `${report.page_count} page(s)` : 'Document'} ·{' '}
                    {formatDisplayDate(report.report_date || report.uploaded_at)}
                  </p>
                </div>
                <StatusBadge
                  status={mapProcessingStatusToVerification(report.processing_status)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-lg border border-line bg-paper/50 p-6 text-center">
            <p className="text-[13px] font-medium text-ink">No reports uploaded yet</p>
            <p className="mt-1 text-[12px] text-slate-body">
              Upload a clinical PDF to begin evidence-first extraction and verification.
            </p>
          </div>
        )}
      </section>
    )
  }

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
          <li
            key={report.id}
            className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
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
