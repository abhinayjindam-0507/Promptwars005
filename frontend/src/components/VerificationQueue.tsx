import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react'
import { verificationQueue } from '../data/mockData'
import { formatDisplayDate } from '../lib/labels'
import type { LabResultResponse, ReportResponse } from '../types/api'
import { DemoBadge } from './DemoBadge'
import { StatusBadge } from './StatusBadge'

interface VerificationQueueProps {
  isLive?: boolean
  patientLabResults?: LabResultResponse[]
  reports?: ReportResponse[]
  patientCode?: string
  onSelectReportId?: (reportId: number) => void
}

interface ConflictItem {
  id: string
  testName: string
  valueA: string
  sourceA: string
  dateA?: string
  pageA?: number
  reportIdA?: number
  valueB: string
  sourceB: string
  dateB?: string
  pageB?: number
  reportIdB?: number
  summary: string
}

export function VerificationQueue({
  isLive = false,
  patientLabResults = [],
  reports = [],
  patientCode,
  onSelectReportId,
}: VerificationQueueProps) {
  // If live mode, detect real conflicts and flagged/unverified items
  if (isLive) {
    const reportMap = new Map<number, ReportResponse>()
    reports.forEach((r) => reportMap.set(r.id, r))

    // 1. Detect conflicts across distinct reports for same analyte
    const resultsByTest = new Map<string, LabResultResponse[]>()
    patientLabResults.forEach((r) => {
      const key = r.test_name.trim().toLowerCase()
      const list = resultsByTest.get(key) || []
      list.push(r)
      resultsByTest.set(key, list)
    })

    const conflicts: ConflictItem[] = []
    resultsByTest.forEach((list, testKey) => {
      if (list.length >= 2) {
        // Compare distinct values
        for (let i = 0; i < list.length - 1; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const rA = list[i]
            const rB = list[j]
            // If values differ across reports or records
            if (rA.value.trim().toLowerCase() !== rB.value.trim().toLowerCase()) {
              const repA = rA.report_id != null ? reportMap.get(rA.report_id) : undefined
              const repB = rB.report_id != null ? reportMap.get(rB.report_id) : undefined
              conflicts.push({
                id: `conflict-${testKey}-${rA.id}-${rB.id}`,
                testName: rA.test_name,
                valueA: `${rA.value}${rA.unit ? ' ' + rA.unit : ''}`,
                sourceA: repA?.file_name || `Report #${rA.report_id || 'A'}`,
                dateA: formatDisplayDate(rA.test_date || repA?.report_date || repA?.uploaded_at),
                pageA: rA.source_page ?? undefined,
                reportIdA: rA.report_id ?? undefined,
                valueB: `${rB.value}${rB.unit ? ' ' + rB.unit : ''}`,
                sourceB: repB?.file_name || `Report #${rB.report_id || 'B'}`,
                dateB: formatDisplayDate(rB.test_date || repB?.report_date || repB?.uploaded_at),
                pageB: rB.source_page ?? undefined,
                reportIdB: rB.report_id ?? undefined,
                summary: `Discrepancy detected between source reports for ${rA.test_name}.`,
              })
            }
          }
        }
      }
    })

    // 2. Collect flagged or unverified results requiring review
    const flaggedItems = patientLabResults.filter(
      (r) => r.verification_status === 'FLAGGED'
    )
    const pendingAbnormalItems = patientLabResults.filter(
      (r) =>
        r.verification_status === 'UNVERIFIED' &&
        (r.status === 'LOW' || r.status === 'HIGH')
    )

    const totalLiveQueueCount = conflicts.length + flaggedItems.length + pendingAbnormalItems.length

    return (
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-ink">Verification queue & conflicts</h2>
              <span className="inline-flex items-center rounded-sm border border-teal/30 bg-teal-mist px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
                Live Data
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-slate-body">
              Discrepancies and extracted findings requiring source comparison for {patientCode || 'patient'}.
            </p>
          </div>
        </div>

        {totalLiveQueueCount === 0 ? (
          <div className="mt-4 rounded-lg border border-line bg-paper/40 p-5 text-center">
            <CheckCircle2 size={24} className="mx-auto text-teal" aria-hidden="true" />
            <p className="mt-2 text-[13px] font-medium text-ink">No conflicts or flagged discrepancies</p>
            <p className="mt-1 text-[12px] text-slate-body">
              All extracted laboratory values are consistent with preserved source documents.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {/* Detected Conflicts */}
            {conflicts.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-rose/40 bg-rose-mist/30 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-rose" aria-hidden="true" />
                    <span className="text-[13px] font-semibold text-ink">
                      Potential conflict detected: {item.testName}
                    </span>
                  </div>
                  <StatusBadge status="conflict" />
                </div>

                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-body">
                  Different values were extracted across separate source reports. Both values are preserved without automated resolution:
                </p>

                <div className="mt-2 grid gap-2 rounded border border-rose/20 bg-surface/80 p-2.5 text-[11.5px] sm:grid-cols-2">
                  <div>
                    <span className="text-slate-body">Source A:</span>{' '}
                    <strong className="text-ink">{item.valueA}</strong>
                    <p className="text-[11px] text-slate-body">
                      {item.sourceA} · {item.pageA != null ? `Page ${item.pageA}` : ''} ({item.dateA})
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-body">Source B:</span>{' '}
                    <strong className="text-ink">{item.valueB}</strong>
                    <p className="text-[11px] text-slate-body">
                      {item.sourceB} · {item.pageB != null ? `Page ${item.pageB}` : ''} ({item.dateB})
                    </p>
                  </div>
                </div>

                {item.reportIdA && onSelectReportId ? (
                  <button
                    type="button"
                    onClick={() => onSelectReportId(item.reportIdA!)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-teal hover:text-teal-bright"
                  >
                    <FileText size={11} aria-hidden="true" />
                    Inspect source report #{item.reportIdA}
                  </button>
                ) : null}
              </li>
            ))}

            {/* Flagged Provenance Items */}
            {flaggedItems.map((item) => {
              const rep = item.report_id != null ? reportMap.get(item.report_id) : undefined
              return (
                <li
                  key={`flagged-${item.id}`}
                  className="rounded-lg border border-amber/40 bg-amber-mist/30 p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold text-ink">
                      Flagged for review: {item.test_name} ({item.value} {item.unit || ''})
                    </p>
                    <StatusBadge status="pending_review" />
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-body">
                    {item.observation || 'Flagged by provenance check. Verify against source document text.'}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-body">
                    {rep?.file_name || `Report #${item.report_id}`} ·{' '}
                    {item.source_page != null ? `Page ${item.source_page}` : 'No page'} ·{' '}
                    Status: {item.status}
                  </p>
                </li>
              )
            })}

            {/* Pending Abnormal Items */}
            {pendingAbnormalItems.map((item) => {
              const rep = item.report_id != null ? reportMap.get(item.report_id) : undefined
              return (
                <li
                  key={`pending-${item.id}`}
                  className="rounded-lg border border-line bg-paper/60 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12.5px] font-medium text-ink">
                      {item.test_name}: <span className="font-semibold">{item.value} {item.unit || ''}</span> ({item.status})
                    </p>
                    <StatusBadge status="in_validation" />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-body">
                    {rep?.file_name || `Report #${item.report_id}`} · Awaiting clinical review confirmation.
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    )
  }

  // Demo Fallback
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
