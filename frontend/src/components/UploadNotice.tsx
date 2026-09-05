import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  FileText,
  FileUp,
  Loader2,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { uploadReport } from '../lib/api.ts'
import type { PatientDetailResponse, ReportUploadResponse } from '../types/api.ts'
import { ApiError } from '../types/api.ts'
import { DemoBadge } from './DemoBadge'

export interface UploadNoticeProps {
  open: boolean
  onClose: () => void
  selectedPatient?: PatientDetailResponse | null
  isLive?: boolean
  onUploadSuccess?: (uploadedReport: ReportUploadResponse) => void | Promise<void>
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB limit
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
  'binary/octet-stream',
])

function validatePdfFile(file: File): string | null {
  if (file.size === 0) {
    return 'The selected file is empty (0 bytes). Please choose a valid document.'
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'File size exceeds the 20 MB limit. Please select a smaller PDF document.'
  }
  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith('.pdf')) {
    return 'Unsupported file format. Only PDF documents (.pdf) are accepted.'
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    return 'Invalid file type. Only PDF documents are accepted.'
  }
  return null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getSafeErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return 'The active patient record was not found on the backend. Please refresh the patient list.'
    }
    if (err.status === 413) {
      return 'The file size exceeds the server limit of 20 MB.'
    }
    if (err.status === 415) {
      return 'The server rejected this file format. Only PDF documents are accepted.'
    }
    if (err.status === 400) {
      return 'Invalid PDF file or upload parameters. Please verify the document is not corrupted.'
    }
    if (err.status === 422) {
      return 'Invalid request format or report date parameter.'
    }
    if (err.status && err.status >= 500) {
      return 'Backend service encountered an error while processing the PDF.'
    }
    if (
      err.message &&
      !err.message.includes('/') &&
      !err.message.includes('\\') &&
      !err.message.includes('Traceback') &&
      !err.message.includes('Exception')
    ) {
      return err.message
    }
  }
  return 'Unable to upload report to backend service. Please check your network connection and try again.'
}

export function UploadNotice({
  open,
  onClose,
  selectedPatient,
  isLive = false,
  onUploadSuccess,
}: UploadNoticeProps) {
  const [file, setFile] = useState<File | null>(null)
  const [reportDate, setReportDate] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<ReportUploadResponse | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const resetUploadState = useCallback(() => {
    setFile(null)
    setReportDate('')
    setValidationError(null)
    setUploadError(null)
    setUploadResult(null)
    setIsDragging(false)
  }, [])

  const handleClose = useCallback(() => {
    if (uploading) return
    resetUploadState()
    onClose()
  }, [uploading, resetUploadState, onClose])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, uploading, handleClose])

  if (!open) {
    return null
  }

  const canUpload = isLive && Boolean(selectedPatient)

  const handleFileSelected = (candidate: File) => {
    setValidationError(null)
    setUploadError(null)
    const errorMsg = validatePdfFile(candidate)
    if (errorMsg) {
      setValidationError(errorMsg)
      setFile(null)
      return
    }
    setFile(candidate)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelected(files[0])
    }
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!uploading && canUpload) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (uploading || !canUpload) return

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      handleFileSelected(droppedFiles[0])
    }
  }

  const handleUpload = async () => {
    if (!file || !selectedPatient || uploading) return

    setUploading(true)
    setUploadError(null)

    try {
      const result = await uploadReport(
        selectedPatient.id,
        file,
        reportDate ? reportDate : undefined
      )
      setUploadResult(result)
      if (onUploadSuccess) {
        void onUploadSuccess(result)
      }
    } catch (err) {
      setUploadError(getSafeErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="fixed inset-0 bg-ink/40 transition-opacity"
        aria-label="Dismiss upload modal"
        onClick={handleClose}
        disabled={uploading}
      />
      <div
        role="dialog"
        aria-labelledby="upload-title"
        aria-modal="true"
        aria-busy={uploading}
        className="relative z-10 w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-xl"
      >
        {!isLive || !selectedPatient ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileUp size={18} className="text-teal" aria-hidden="true" />
                <h2 id="upload-title" className="text-[16px] font-semibold text-ink">
                  Upload Report
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <DemoBadge />
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md p-1 text-slate-body hover:bg-paper"
                  aria-label="Close dialog"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-amber/30 bg-amber-mist/50 p-4 text-[13px] text-ink">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-amber-900">
                    {!isLive
                      ? 'Backend service is unreachable'
                      : 'No active patient record selected'}
                  </p>
                  <p className="mt-1 leading-relaxed text-slate-body">
                    {!isLive
                      ? 'The MedLens backend service is currently offline. Uploading clinical documents requires an active connection to the backend database.'
                      : 'Please select or register a patient record before uploading clinical documents.'}
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[12.5px] leading-relaxed text-slate-body">
              Live uploads cannot be performed against synthetic preview data to preserve medical record integrity.
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-teal px-4 text-[13px] font-medium text-surface transition-colors hover:bg-teal-bright"
              >
                Continue reviewing demo data
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileUp size={18} className="text-teal" aria-hidden="true" />
                  <h2 id="upload-title" className="text-[16px] font-semibold text-ink">
                    Upload Report
                  </h2>
                  <span className="inline-flex items-center rounded-sm border border-teal/30 bg-teal-mist px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
                    Live
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-slate-body">
                  Attaching document to{' '}
                  <strong className="font-semibold text-ink">
                    {selectedPatient.patient_code}
                  </strong>{' '}
                  ({selectedPatient.name})
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="rounded-md p-1 text-slate-body hover:bg-paper disabled:opacity-40"
                aria-label="Close dialog"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {uploadResult ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-teal/30 bg-teal-mist/50 p-4">
                  <CheckCircle2 size={22} className="shrink-0 text-teal" aria-hidden="true" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-ink">
                      Report uploaded successfully
                    </h3>
                    <p className="text-[12.5px] text-slate-body">
                      Stored as Report #{uploadResult.report_id} and added to patient record.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-line bg-paper/60 p-3.5 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-slate-body">Document:</span>
                    <span className="max-w-[260px] truncate font-medium text-ink">
                      {uploadResult.file_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-body">Page Count:</span>
                    <span className="font-medium text-ink">{uploadResult.page_count} page(s)</span>
                  </div>
                  {uploadResult.report_date ? (
                    <div className="flex justify-between">
                      <span className="text-slate-body">Report Date:</span>
                      <span className="font-medium text-ink">{uploadResult.report_date}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-slate-body">Processing Status:</span>
                    <span className="font-medium text-teal">{uploadResult.processing_status}</span>
                  </div>
                </div>

                {uploadResult.extraction_status === 'OCR_REQUIRED' ? (
                  <div
                    className="rounded-lg border border-amber/30 bg-amber-mist/60 p-3.5 text-[12.5px]"
                    role="status"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
                      <div className="space-y-1">
                        <p className="font-semibold text-ink">
                          Scanned Document Detected (OCR Required)
                        </p>
                        <p className="leading-relaxed text-slate-body">
                          The PDF was uploaded and stored securely, but contains no selectable text stream. Optical Character Recognition (OCR) is required to parse clinical facts and will be available in a future milestone.
                        </p>
                        <p className="font-medium text-amber-800 text-[11.5px]">
                          Note: Selectable text was not extracted. AI interpretation is pending OCR.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-lg border border-teal/30 bg-teal-mist/60 p-3.5 text-[12.5px]"
                    role="status"
                  >
                    <div className="flex items-start gap-2">
                      <FileCheck2 size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
                      <div className="space-y-1">
                        <p className="font-semibold text-ink">
                          Text Extracted & Indexed
                        </p>
                        <p className="leading-relaxed text-slate-body">
                          Text was successfully extracted across {uploadResult.page_count} page(s) and stored for provenance tracking. The document is indexed and ready for clinical verification.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetUploadState}
                    className="rounded-lg border border-line bg-surface px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-paper"
                  >
                    Upload Another
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg bg-teal px-4 py-2 text-[13px] font-medium text-surface transition-colors hover:bg-teal-bright"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {validationError ? (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="flex items-start gap-2 rounded-lg border border-rose/30 bg-rose-mist/60 p-3 text-[12.5px] text-ink"
                  >
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
                    <span>{validationError}</span>
                  </div>
                ) : null}

                {uploadError ? (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="flex items-start gap-2 rounded-lg border border-rose/30 bg-rose-mist/60 p-3 text-[12.5px] text-ink"
                  >
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
                    <span>{uploadError}</span>
                  </div>
                ) : null}

                {!file ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                      isDragging
                        ? 'border-teal bg-teal-mist/30'
                        : 'border-line bg-paper/40 hover:bg-paper/70'
                    }`}
                  >
                    <UploadCloud size={32} className="text-teal" aria-hidden="true" />
                    <p className="mt-2 text-[14px] font-medium text-ink">
                      Drag and drop your PDF here
                    </p>
                    <p className="mt-1 text-[12px] text-slate-body">
                      Accepts clinical reports in PDF format up to 20 MB.
                    </p>
                    <div className="mt-4">
                      <input
                        type="file"
                        id="clinical-report-file-input"
                        accept=".pdf,application/pdf"
                        onChange={handleFileInputChange}
                        className="sr-only"
                        aria-label="Select clinical report PDF document"
                      />
                      <label
                        htmlFor="clinical-report-file-input"
                        className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-teal px-3.5 py-2 text-[12.5px] font-medium text-surface transition-colors hover:bg-teal-bright"
                      >
                        Browse PDF File
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-line bg-paper/60 p-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText size={22} className="shrink-0 text-teal" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-ink">
                            {file.name}
                          </p>
                          <p className="text-[11.5px] text-slate-body">
                            {formatFileSize(file.size)} · PDF Document
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null)
                          setValidationError(null)
                          setUploadError(null)
                        }}
                        disabled={uploading}
                        className="ml-3 shrink-0 rounded-md p-1.5 text-slate-body transition-colors hover:bg-paper hover:text-rose disabled:opacity-40"
                        aria-label="Remove selected file"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>

                    <div>
                      <label
                        htmlFor="report-date-input"
                        className="block text-[12px] font-medium text-slate-body"
                      >
                        Report Date (optional)
                      </label>
                      <input
                        type="date"
                        id="report-date-input"
                        value={reportDate}
                        onChange={(e) => setReportDate(e.target.value)}
                        disabled={uploading}
                        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                      />
                      <p className="mt-1 text-[11px] text-slate-body">
                        Specifying the clinical report date aids chronological ordering.
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={uploading}
                        className="rounded-lg border border-line bg-surface px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal px-4 py-2 text-[13px] font-medium text-surface shadow-[0_1px_0_rgb(255_255_255_/_0.15)_inset] transition-colors hover:bg-teal-bright disabled:opacity-50"
                        aria-label={uploading ? 'Uploading and extracting document' : 'Upload medical report'}
                      >
                        {uploading ? (
                          <>
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                            <span>Uploading & Extracting...</span>
                          </>
                        ) : (
                          <>
                            <FileUp size={15} aria-hidden="true" />
                            <span>Upload Document</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
