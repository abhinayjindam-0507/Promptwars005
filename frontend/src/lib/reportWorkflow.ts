import type { LabResultResponse, LabResultStatus, ReportResponse } from '../types/api.ts'
import { ApiError } from '../types/api.ts'

export const UNDETERMINED_EXPLANATION =
  'Reference range unavailable or result could not be deterministically classified.'

export function isOcrRequired(report: Pick<ReportResponse, 'extraction_status' | 'extracted_text_available'>): boolean {
  return report.extraction_status === 'OCR_REQUIRED' || !report.extracted_text_available
}

export function isAiExtractionComplete(report: Pick<ReportResponse, 'extraction_status'>): boolean {
  return report.extraction_status === 'AI_EXTRACTION_COMPLETED'
}

export function canProcessReport(report: ReportResponse): boolean {
  return !isOcrRequired(report) && !isAiExtractionComplete(report)
}

export function formatReferenceRange(result: LabResultResponse): string {
  if (result.reference_range_text && result.reference_range_text.trim()) {
    return result.reference_range_text.trim()
  }
  if (result.reference_low != null && result.reference_high != null) {
    return `${result.reference_low} – ${result.reference_high}`
  }
  return 'Not provided in source'
}

export function formatExtractionConfidence(value?: number | null): string | null {
  if (value == null || Number.isNaN(value)) return null
  const percent = value <= 1 ? value * 100 : value
  return `${Math.round(percent)}%`
}

export function labStatusLabel(status: LabResultStatus | string): string {
  switch (status) {
    case 'LOW':
      return 'LOW'
    case 'NORMAL':
      return 'NORMAL'
    case 'HIGH':
      return 'HIGH'
    case 'UNDETERMINED':
      return 'UNDETERMINED'
    default:
      return String(status)
  }
}

export function verificationLabel(status?: string | null): string {
  switch (status) {
    case 'VERIFIED':
      return 'Verified'
    case 'FLAGGED':
      return 'Flagged for review'
    case 'REJECTED':
      return 'Rejected'
    case 'UNVERIFIED':
    default:
      return 'AI extracted • Pending human verification'
  }
}

function looksUnsafe(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    message.includes('/') ||
    message.includes('\\') ||
    lower.includes('traceback') ||
    lower.includes('exception') ||
    lower.includes('openai') ||
    lower.includes('api_key') ||
    lower.includes('api key') ||
    lower.includes('disk') ||
    lower.includes('storage_key')
  )
}

export function getSafeProcessErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return 'This report was not found. It may have been removed. Refresh the report list and try again.'
    }
    if (err.status === 400) {
      return 'This report cannot be processed with selectable-text extraction. If the document is scanned, OCR support is not currently enabled.'
    }
    if (err.status === 409) {
      return 'This report is already being processed. Wait a moment, then refresh results.'
    }
    if (err.status === 413) {
      return 'The report is too large for the processing service.'
    }
    if (err.status === 415) {
      return 'This document format is not supported for processing.'
    }
    if (err.status === 422) {
      return 'The report could not be processed because the request was invalid.'
    }
    if (err.status === 503) {
      return 'Clinical extraction service is unavailable. Processing did not complete.'
    }
    if (err.status && err.status >= 500) {
      return 'Backend service encountered an error while processing this report. Processing did not complete.'
    }
    if (err.code === 'NETWORK_ERROR' || err.status == null) {
      return 'Unable to reach the backend service. Processing did not complete.'
    }
    if (err.message && !looksUnsafe(err.message)) {
      return err.message
    }
  }
  return 'Unable to process this report. Check the backend connection and try again.'
}

export function getSafeResultsErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return 'Laboratory results for this report were not found. Refresh the report list and try again.'
    }
    if (err.status === 422) {
      return 'Laboratory results could not be retrieved because the request was invalid.'
    }
    if (err.status === 503) {
      return 'Backend service is unavailable. Laboratory results could not be loaded.'
    }
    if (err.status && err.status >= 500) {
      return 'Backend service encountered an error while loading laboratory results.'
    }
    if (err.code === 'NETWORK_ERROR' || err.status == null) {
      return 'Unable to reach the backend service. Laboratory results could not be loaded.'
    }
    if (err.message && !looksUnsafe(err.message)) {
      return err.message
    }
  }
  return 'Unable to load laboratory results. Check the backend connection and try again.'
}
