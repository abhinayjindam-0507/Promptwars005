import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit2,
  FileText,
  Filter,
  Loader2,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { verifyLabResult } from '../lib/api.ts'
import {
  formatExtractionConfidence,
  formatReferenceRange,
  UNDETERMINED_EXPLANATION,
  verificationLabel,
} from '../lib/reportWorkflow.ts'
import type { LabResultResponse, VerificationStatus } from '../types/api.ts'
import { LabStatusBadge } from './LabStatusBadge.tsx'

interface LabResultsListProps {
  results: LabResultResponse[]
  isLive?: boolean
  onResultUpdated?: (updated: LabResultResponse) => void
}

export function LabResultsList({
  results,
  isLive = false,
  onResultUpdated,
}: LabResultsListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [verifFilter, setVerifFilter] = useState<string>('ALL')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-paper/50 p-5 text-center" role="status">
        <p className="text-[13px] font-medium text-ink">No laboratory results extracted</p>
        <p className="mt-1 text-[12px] text-slate-body">
          Processing completed, but no structured laboratory results were persisted for this report.
        </p>
      </div>
    )
  }

  // Filter results
  const filtered = results.filter((res) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      const matchName = res.test_name.toLowerCase().includes(q)
      const matchVal = res.value.toLowerCase().includes(q)
      if (!matchName && !matchVal) return false
    }
    if (statusFilter !== 'ALL' && res.status !== statusFilter) {
      return false
    }
    if (verifFilter !== 'ALL') {
      if (verifFilter === 'UNVERIFIED' && res.verification_status !== 'UNVERIFIED') return false
      if (verifFilter === 'VERIFIED' && res.verification_status !== 'VERIFIED') return false
      if (verifFilter === 'FLAGGED' && res.verification_status !== 'FLAGGED') return false
      if (verifFilter === 'REJECTED' && res.verification_status !== 'REJECTED') return false
    }
    return true
  })

  const handleAction = async (
    result: LabResultResponse,
    action: 'CONFIRMED' | 'FLAGGED' | 'REJECTED' | 'EDITED',
    newVal?: string
  ) => {
    setActionError(null)
    setLoadingId(result.id)

    try {
      if (isLive) {
        const updated = await verifyLabResult(result.id, {
          action,
          verified_value: newVal,
          verified_by: 'Reviewing Clinician',
        })
        setEditingId(null)
        onResultUpdated?.(updated)
      } else {
        // Safe demo state update
        const updated: LabResultResponse = {
          ...result,
          verification_status: (action === 'CONFIRMED' || action === 'EDITED'
            ? 'VERIFIED'
            : action === 'FLAGGED'
            ? 'FLAGGED'
            : 'REJECTED') as VerificationStatus,
          value: newVal || result.value,
        }
        setEditingId(null)
        onResultUpdated?.(updated)
      }
    } catch {
      setActionError('Verification action could not be recorded. Check backend connection and try again.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* Search & Filter Bar */}
      <div className="rounded-lg border border-line bg-paper/40 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-body pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search analytes (e.g. Glucose, WBC)..."
              aria-label="Filter laboratory tests"
              className="w-full rounded-md border border-line bg-surface pl-8 pr-3 py-1.5 text-[12.5px] text-ink placeholder:text-slate-body/70 focus:border-teal focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11.5px]">
            <Filter size={13} className="text-slate-body" aria-hidden="true" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by classification status"
              className="rounded border border-line bg-surface px-2 py-1 text-[12px] text-ink focus:border-teal focus:outline-none"
            >
              <option value="ALL">All classifications ({results.length})</option>
              <option value="LOW">Low values</option>
              <option value="NORMAL">Normal values</option>
              <option value="HIGH">High values</option>
              <option value="UNDETERMINED">Undetermined</option>
            </select>

            <select
              value={verifFilter}
              onChange={(e) => setVerifFilter(e.target.value)}
              aria-label="Filter by verification status"
              className="rounded border border-line bg-surface px-2 py-1 text-[12px] text-ink focus:border-teal focus:outline-none"
            >
              <option value="ALL">All verification states</option>
              <option value="UNVERIFIED">Pending review</option>
              <option value="VERIFIED">Verified</option>
              <option value="FLAGGED">Flagged</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose/30 bg-rose-mist/60 p-3 text-[12px] text-ink"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] text-slate-body">
          No laboratory results match the current filters.
        </p>
      ) : null}

      <ul className="space-y-3" aria-label="Extracted laboratory results">
        {filtered.map((result) => {
          const confidence = formatExtractionConfidence(result.extraction_confidence)
          const isUndetermined = result.status === 'UNDETERMINED'
          const isVerified = result.verification_status === 'VERIFIED'
          const isFlagged = result.verification_status === 'FLAGGED'
          const isRejected = result.verification_status === 'REJECTED'
          const isPending = !isVerified && !isRejected && !isFlagged
          const isLoading = loadingId === result.id
          const isEditing = editingId === result.id

          return (
            <li
              key={result.id}
              className={`rounded-lg border p-3.5 transition-colors ${
                isVerified
                  ? 'border-teal/30 bg-teal-mist/15'
                  : isFlagged
                  ? 'border-amber/40 bg-amber-mist/20'
                  : isRejected
                  ? 'border-line bg-paper/40 opacity-70'
                  : 'border-line bg-paper/50'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-[13.5px] font-semibold ${isRejected ? 'line-through text-slate-body' : 'text-ink'}`}>
                      {result.test_name}
                    </h4>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-mist px-2 py-0.5 text-[10px] font-semibold text-teal">
                        <ShieldCheck size={11} aria-hidden="true" />
                        Verified
                      </span>
                    ) : isFlagged ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-mist px-2 py-0.5 text-[10px] font-semibold text-amber">
                        <AlertTriangle size={11} aria-hidden="true" />
                        Flagged
                      </span>
                    ) : isRejected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold text-slate-body">
                        <XCircle size={11} aria-hidden="true" />
                        Rejected
                      </span>
                    ) : null}
                  </div>

                  {!isEditing ? (
                    <p className="mt-0.5 text-[12.5px] text-slate-body">
                      <span className={`font-semibold ${isRejected ? 'line-through text-slate-body' : 'text-ink'}`}>
                        {result.value}
                      </span>
                      {result.unit ? ` ${result.unit}` : ''}
                    </p>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Corrected value"
                        className="rounded border border-teal bg-surface px-2.5 py-1 text-[12.5px] text-ink focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => void handleAction(result, 'EDITED', editValue)}
                        disabled={isLoading || !editValue.trim()}
                        className="inline-flex items-center gap-1 rounded bg-teal px-2.5 py-1 text-[11px] font-medium text-surface hover:bg-teal-bright disabled:opacity-50"
                      >
                        <Check size={12} aria-hidden="true" />
                        Save & Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded border border-line bg-surface px-2 py-1 text-[11px] font-medium text-slate-body hover:bg-paper"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <LabStatusBadge status={result.status} />
              </div>

              <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
                <div>
                  <dt className="text-slate-body">Source reference range</dt>
                  <dd className="font-medium text-ink">{formatReferenceRange(result)}</dd>
                </div>
                <div>
                  <dt className="text-slate-body">Document location</dt>
                  <dd className="font-medium text-ink">
                    {result.source_page != null ? `Page ${result.source_page}` : 'Not provided'}
                  </dd>
                </div>
                {result.observation ? (
                  <div className="sm:col-span-2">
                    <dt className="text-slate-body">Observation</dt>
                    <dd className="font-medium text-ink">{result.observation}</dd>
                  </div>
                ) : null}
                {confidence ? (
                  <div>
                    <dt className="text-slate-body">Documentary confidence</dt>
                    <dd className="font-medium text-ink" title="Documentary extraction certainty, not medical accuracy">
                      {confidence}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-slate-body">Review state</dt>
                  <dd className="font-medium text-ink">{verificationLabel(result.verification_status)}</dd>
                </div>
              </dl>

              {isUndetermined ? (
                <p className="mt-2 text-[11.5px] leading-relaxed text-slate-body" role="note">
                  {UNDETERMINED_EXPLANATION}
                </p>
              ) : null}

              {isPending ? (
                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-amber">
                  AI extracted • Pending human verification
                </p>
              ) : null}

              {/* Evidence Drawer */}
              <details className="mt-3 rounded-md border border-line bg-surface">
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-[12px] font-medium text-ink hover:bg-paper/50">
                  <span className="flex items-center gap-1.5">
                    <FileText size={13} className="text-teal" aria-hidden="true" />
                    Source Evidence Traceability
                  </span>
                  <span className="text-[11px] font-normal text-slate-body">
                    {result.source_page != null ? `Page ${result.source_page}` : ''}
                  </span>
                </summary>
                <div className="space-y-2 border-t border-line px-3 py-2.5 text-[12px]">
                  <div className="flex items-center justify-between text-[11px] text-slate-body">
                    <span>Source document page: <strong className="text-ink">{result.source_page ?? '—'}</strong></span>
                    <span>Range origin: <strong className="text-ink">Report text</strong></span>
                  </div>
                  <blockquote className="rounded-md border-l-2 border-teal bg-paper px-3 py-2 font-mono text-[11.5px] text-ink-soft">
                    {result.source_text?.trim()
                      ? result.source_text
                      : 'No verbatim source text was preserved for this extracted result.'}
                  </blockquote>
                  <p className="text-[10.5px] text-slate-body">
                    Reference ranges are strictly extracted from this source text. The system never generates or infers medical ranges.
                  </p>
                </div>
              </details>

              {/* Clinical Verification Actions */}
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line/60 pt-2.5">
                <span className="mr-auto text-[11px] text-slate-body">
                  Clinician review:
                </span>
                <button
                  type="button"
                  onClick={() => void handleAction(result, 'CONFIRMED')}
                  disabled={isLoading}
                  className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                    isVerified
                      ? 'border-teal bg-teal text-surface'
                      : 'border-line bg-surface text-ink hover:border-teal hover:text-teal'
                  } disabled:opacity-50`}
                  aria-label={`Verify extracted value for ${result.test_name}`}
                >
                  {isLoading ? (
                    <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={12} aria-hidden="true" />
                  )}
                  Verify
                </button>

                <button
                  type="button"
                  onClick={() => void handleAction(result, 'FLAGGED')}
                  disabled={isLoading}
                  className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                    isFlagged
                      ? 'border-amber bg-amber text-surface'
                      : 'border-line bg-surface text-ink hover:border-amber hover:text-amber'
                  } disabled:opacity-50`}
                  aria-label={`Flag ${result.test_name} for clinical review`}
                >
                  <AlertTriangle size={12} aria-hidden="true" />
                  Flag
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingId(result.id)
                    setEditValue(result.value)
                  }}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 rounded border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink hover:bg-paper disabled:opacity-50"
                  aria-label={`Edit extracted value for ${result.test_name}`}
                >
                  <Edit2 size={12} aria-hidden="true" />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => void handleAction(result, 'REJECTED')}
                  disabled={isLoading}
                  className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                    isRejected
                      ? 'border-rose bg-rose text-surface'
                      : 'border-line bg-surface text-ink hover:border-rose hover:text-rose'
                  } disabled:opacity-50`}
                  aria-label={`Reject extracted result for ${result.test_name}`}
                >
                  <XCircle size={12} aria-hidden="true" />
                  Reject
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
