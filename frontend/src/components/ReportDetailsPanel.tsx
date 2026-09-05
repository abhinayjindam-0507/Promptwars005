import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileSearch,
  Loader2,
  Printer,
  RefreshCw,
  ScanLine,
  X,
} from 'lucide-react'
import { getReport, getReportLabResults, processReport } from '../lib/api.ts'
import { extractionStatusLabel, formatDisplayDate, processingStatusLabel } from '../lib/labels'
import {
  canProcessReport,
  getSafeProcessErrorMessage,
  getSafeResultsErrorMessage,
  isAiExtractionComplete,
  isOcrRequired,
} from '../lib/reportWorkflow'
import type { LabResultResponse, ReportResponse } from '../types/api.ts'
import { LabResultsList } from './LabResultsList'

export interface ReportDetailsPanelProps {
  open: boolean
  report: ReportResponse | null
  isLive: boolean
  patientCode?: string
  onClose: () => void
  onProcessed?: () => void | Promise<void>
}

export function ReportDetailsPanel({
  open,
  report,
  isLive,
  patientCode,
  onClose,
  onProcessed,
}: ReportDetailsPanelProps) {
  const reportId = report?.id ?? null
  const [detail, setDetail] = useState<ReportResponse | null>(report)
  const [results, setResults] = useState<LabResultResponse[] | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(Boolean(open && isLive && report))
  const [loadingResults, setLoadingResults] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [processSuccess, setProcessSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const processingLock = useRef(false)

  const handleClose = useCallback(() => {
    if (processing) return
    onClose()
  }, [processing, onClose])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processing) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, processing, onClose])

  useEffect(() => {
    if (!open || !isLive || reportId == null) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const fresh = await getReport(reportId)
        if (cancelled) return
        setDetail(fresh)

        if (!isOcrRequired(fresh) && (isAiExtractionComplete(fresh) || fresh.extracted_text_available)) {
          setLoadingResults(true)
          try {
            const labResults = await getReportLabResults(fresh.id)
            if (cancelled) return
            setResults(labResults)
          } catch (err) {
            if (cancelled) return
            if (isAiExtractionComplete(fresh)) {
              setError(getSafeResultsErrorMessage(err))
            } else {
              setResults([])
            }
          } finally {
            if (!cancelled) setLoadingResults(false)
          }
        }
      } catch (err) {
        if (cancelled) return
        setError(getSafeResultsErrorMessage(err))
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, isLive, reportId])

  if (!open) {
    return null
  }

  const activeReport = detail ?? report
  const ocrRequired = activeReport ? isOcrRequired(activeReport) : false
  const aiComplete = activeReport ? isAiExtractionComplete(activeReport) : false
  const canProcess = isLive && activeReport ? canProcessReport(activeReport) : false
  const hasResults = (results?.length ?? 0) > 0
  const showResultsSection = Boolean(aiComplete || hasResults)

  const handleProcess = async () => {
    if (!activeReport || processingLock.current || processing || !canProcess) return
    processingLock.current = true
    setProcessing(true)
    setError(null)
    setProcessSuccess(null)

    try {
      const response = await processReport(activeReport.id)
      setDetail((current) =>
        current
          ? {
              ...current,
              processing_status: response.processing_status,
              extraction_status: response.extraction_status,
            }
          : current
      )
      setResults(response.lab_results)
      setProcessSuccess(
        `Extraction finished. ${response.persisted_results_count} laboratory result(s) stored from the source report.`
      )
      if (onProcessed) {
        await onProcessed()
      }
    } catch (err) {
      setError(getSafeProcessErrorMessage(err))
    } finally {
      processingLock.current = false
      setProcessing(false)
    }
  }

  const handleRefreshResults = async () => {
    if (!activeReport || processing || refreshing) return
    setRefreshing(true)
    setLoadingResults(true)
    setError(null)
    try {
      const labResults = await getReportLabResults(activeReport.id)
      setResults(labResults)
      if (onProcessed) {
        await onProcessed()
      }
    } catch (err) {
      setError(getSafeResultsErrorMessage(err))
    } finally {
      setLoadingResults(false)
      setRefreshing(false)
    }
  }

  const handleExportSummary = () => {
    if (!activeReport) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const resultsHtml = (results || [])
      .map(
        (r) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${r.test_name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${r.value} ${r.unit || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${r.reference_range_text || (r.reference_low != null && r.reference_high != null ? `${r.reference_low} – ${r.reference_high}` : 'Not provided in source')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${r.status}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${r.verification_status}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${r.source_page != null ? `Page ${r.source_page}` : '—'}</td>
      </tr>
    `
      )
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MedLens Clinical Report Summary - ${activeReport.file_name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #101c1a; padding: 24px; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 20px; margin-bottom: 4px; color: #1a5c54; }
            .meta { font-size: 13px; color: #5a6b68; margin-bottom: 20px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
            th { text-align: left; padding: 8px; background: #eef2f0; border-bottom: 2px solid #c3cfcc; }
            .disclaimer { border-top: 1px solid #d5dedb; padding-top: 12px; font-size: 11px; color: #5a6b68; line-height: 1.5; }
          </style>
        </head>
        <body>
          <h1>MedLens — Source-Verified Clinical Report Summary</h1>
          <div class="meta">
            <strong>Patient Identifier:</strong> ${patientCode || 'N/A'}<br/>
            <strong>Source Document:</strong> ${activeReport.file_name}<br/>
            <strong>Report Date:</strong> ${formatDisplayDate(activeReport.report_date)} | <strong>Uploaded:</strong> ${formatDisplayDate(activeReport.uploaded_at)}<br/>
            <strong>Extraction Status:</strong> ${activeReport.extraction_status || 'Indexed'}
          </div>

          <table>
            <thead>
              <tr>
                <th>Test Name</th>
                <th>Extracted Value</th>
                <th>Source Reference Range</th>
                <th>Status</th>
                <th>Verification State</th>
                <th>Source Location</th>
              </tr>
            </thead>
            <tbody>
              ${resultsHtml || '<tr><td colspan="6" style="padding: 16px; text-align: center;">No laboratory results found.</td></tr>'}
            </tbody>
          </table>

          <div class="disclaimer">
            <strong>Safety Notice:</strong> MedLens is an information organization and review tool. It does not provide medical diagnosis or treatment recommendations. All reference ranges are strictly extracted from the source document without clinical inference.
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="fixed inset-0 bg-ink/40 transition-opacity"
        aria-label="Dismiss report details"
        onClick={handleClose}
        disabled={processing}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-details-title"
        aria-busy={processing || loadingDetail || loadingResults}
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="report-details-title" className="truncate text-[16px] font-semibold text-ink">
              {!isLive
                ? 'Report processing unavailable'
                : activeReport?.file_name || 'Report details'}
            </h2>
            <p className="mt-1 text-[12.5px] text-slate-body">
              {patientCode ? `${patientCode} · ` : ''}
              Review extracted laboratory facts from this uploaded document.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={processing}
            className="rounded-md p-1 text-slate-body hover:bg-paper disabled:opacity-40"
            aria-label="Close report details"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!isLive ? (
            <div className="rounded-lg border border-amber/30 bg-amber-mist/50 p-4" role="status">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
                <div>
                  <p className="text-[13px] font-semibold text-ink">Backend service is unreachable</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate-body">
                    Report processing and live laboratory results require an active backend connection.
                    Processing was not started, and no live results are shown.
                  </p>
                </div>
              </div>
            </div>
          ) : !activeReport ? (
            <p className="text-[13px] text-slate-body">No report selected.</p>
          ) : (
            <div className="space-y-4">
              {loadingDetail ? (
                <p className="text-[12px] text-slate-body" aria-live="polite">
                  Loading report details...
                </p>
              ) : null}

              <dl className="grid gap-2 rounded-lg border border-line bg-paper/60 p-3.5 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-slate-body">Filename</dt>
                  <dd className="truncate font-medium text-ink">{activeReport.file_name}</dd>
                </div>
                <div>
                  <dt className="text-slate-body">Report date</dt>
                  <dd className="font-medium text-ink">{formatDisplayDate(activeReport.report_date)}</dd>
                </div>
                <div>
                  <dt className="text-slate-body">Upload date</dt>
                  <dd className="font-medium text-ink">{formatDisplayDate(activeReport.uploaded_at)}</dd>
                </div>
                <div>
                  <dt className="text-slate-body">Page count</dt>
                  <dd className="font-medium text-ink">
                    {activeReport.page_count != null ? `${activeReport.page_count} page(s)` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-body">Processing status</dt>
                  <dd className="font-medium text-ink">
                    {processingStatusLabel(activeReport.processing_status)}
                    <span className="sr-only"> ({activeReport.processing_status})</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-body">Extraction status</dt>
                  <dd className="font-medium text-ink">
                    {extractionStatusLabel(activeReport.extraction_status)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-body">Extracted text</dt>
                  <dd className="font-medium text-ink">
                    {activeReport.extracted_text_available
                      ? 'Selectable text is available'
                      : 'Selectable text is not available'}
                  </dd>
                </div>
              </dl>

              {ocrRequired ? (
                <div className="rounded-lg border border-amber/30 bg-amber-mist/60 p-3.5" role="status">
                  <div className="flex items-start gap-2">
                    <ScanLine size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
                    <div className="text-[12.5px]">
                      <p className="font-semibold text-ink">OCR required — processing unavailable</p>
                      <p className="mt-1 leading-relaxed text-slate-body">
                        Selectable text was not available in this PDF. Optical character recognition (OCR)
                        is not currently enabled, so laboratory extraction cannot be started for this document.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2 rounded-lg border border-rose/30 bg-rose-mist/60 p-3 text-[12.5px] text-ink"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}

              {processSuccess ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-start gap-2 rounded-lg border border-teal/30 bg-teal-mist/60 p-3 text-[12.5px] text-ink"
                >
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
                  <span>{processSuccess}</span>
                </div>
              ) : null}

              {processing ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-lg border border-line bg-paper/60 p-3 text-[12.5px] text-ink"
                >
                  <Loader2 size={15} className="animate-spin text-teal" aria-hidden="true" />
                  Extracting laboratory results from the source report. This may take a moment.
                </div>
              ) : null}

              {showResultsSection ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-[14px] font-semibold text-ink">Extracted laboratory results</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-body">
                      Status values (LOW, NORMAL, HIGH, UNDETERMINED) come from the backend’s deterministic
                      classification against source reference ranges. Extraction confidence is documentary
                      certainty, not medical accuracy. These are AI-extracted source facts until a reviewer
                      verifies them.
                    </p>
                  </div>
                  {loadingResults ? (
                    <div className="space-y-2" aria-busy="true" aria-label="Loading laboratory results">
                      <div className="h-24 animate-pulse rounded-lg border border-line bg-paper" />
                      <div className="h-24 animate-pulse rounded-lg border border-line bg-paper" />
                    </div>
                  ) : (
                    <LabResultsList
                      results={results || []}
                      isLive={isLive}
                      onResultUpdated={(updated) => {
                        setResults((prev) =>
                          prev ? prev.map((item) => (item.id === updated.id ? updated : item)) : [updated]
                        )
                        if (onProcessed) {
                          void onProcessed()
                        }
                      }}
                    />
                  )}
                </div>
              ) : loadingResults ? (
                <div className="h-24 animate-pulse rounded-lg border border-line bg-paper" aria-busy="true" />
              ) : null}
            </div>
          )}
        </div>

        {isLive && activeReport ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
            {hasResults ? (
              <button
                type="button"
                onClick={handleExportSummary}
                className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-paper"
                aria-label="Export report summary as printable document"
              >
                <Printer size={13} aria-hidden="true" />
                Export Summary
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleClose}
              disabled={processing}
              className="rounded-lg border border-line bg-surface px-4 py-2 text-[13px] font-medium text-ink hover:bg-paper disabled:opacity-50"
            >
              Close
            </button>
            {aiComplete || hasResults ? (
              <button
                type="button"
                onClick={() => void handleRefreshResults()}
                disabled={processing || refreshing || loadingResults}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-[13px] font-medium text-ink hover:bg-paper disabled:opacity-50"
                aria-label="Refresh laboratory results"
              >
                {refreshing ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw size={14} aria-hidden="true" />
                )}
                Refresh Results
              </button>
            ) : null}
            {canProcess && !hasResults ? (
              <button
                type="button"
                onClick={() => void handleProcess()}
                disabled={processing}
                className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-[13px] font-medium text-surface hover:bg-teal-bright disabled:opacity-50"
                aria-label={processing ? 'Processing report' : 'Process report'}
              >
                {processing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileSearch size={14} aria-hidden="true" />
                    Process Report
                  </>
                )}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex justify-end border-t border-line px-5 py-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-teal px-4 py-2 text-[13px] font-medium text-surface hover:bg-teal-bright"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
