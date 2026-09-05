import type { LabResultResponse } from '../types/api'
import {
  formatExtractionConfidence,
  formatReferenceRange,
  UNDETERMINED_EXPLANATION,
  verificationLabel,
} from '../lib/reportWorkflow'
import { LabStatusBadge } from './LabStatusBadge'

interface LabResultsListProps {
  results: LabResultResponse[]
}

export function LabResultsList({ results }: LabResultsListProps) {
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

  return (
    <ul className="space-y-3" aria-label="Extracted laboratory results">
      {results.map((result) => {
        const confidence = formatExtractionConfidence(result.extraction_confidence)
        const isUndetermined = result.status === 'UNDETERMINED'
        const pendingVerification =
          result.verification_status !== 'VERIFIED' && result.verification_status !== 'REJECTED'

        return (
          <li
            key={result.id}
            className="rounded-lg border border-line bg-paper/50 p-3.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-[13.5px] font-semibold text-ink">{result.test_name}</h4>
                <p className="mt-0.5 text-[12.5px] text-slate-body">
                  <span className="font-medium text-ink">{result.value}</span>
                  {result.unit ? ` ${result.unit}` : ''}
                </p>
              </div>
              <LabStatusBadge status={result.status} />
            </div>

            <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
              <div>
                <dt className="text-slate-body">Reference range</dt>
                <dd className="font-medium text-ink">{formatReferenceRange(result)}</dd>
              </div>
              <div>
                <dt className="text-slate-body">Source page</dt>
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
                  <dt className="text-slate-body">Extraction confidence</dt>
                  <dd className="font-medium text-ink">{confidence}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-slate-body">Verification</dt>
                <dd className="font-medium text-ink">{verificationLabel(result.verification_status)}</dd>
              </div>
            </dl>

            {isUndetermined ? (
              <p className="mt-2 text-[11.5px] leading-relaxed text-slate-body" role="note">
                {UNDETERMINED_EXPLANATION}
              </p>
            ) : null}

            {pendingVerification ? (
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-amber">
                Extracted information — not medically verified
              </p>
            ) : (
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-teal">
                Verified information
              </p>
            )}

            <details className="mt-3 rounded-md border border-line bg-surface">
              <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-ink">
                Evidence from source report
              </summary>
              <div className="space-y-2 border-t border-line px-3 py-2 text-[12px]">
                <p className="text-slate-body">
                  Source page:{' '}
                  <span className="font-medium text-ink">
                    {result.source_page != null ? result.source_page : 'Not provided'}
                  </span>
                </p>
                <blockquote className="rounded-md bg-paper px-3 py-2 text-ink-soft">
                  {result.source_text?.trim()
                    ? result.source_text
                    : 'No source text was stored for this extracted result.'}
                </blockquote>
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
