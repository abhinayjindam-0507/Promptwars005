/**
 * Typed API client for MedLens backend communication.
 * Uses fetch with proper error handling and type safety.
 */

import type {
  ApiRequestOptions,
  ApiResponse,
  LabResultResponse,
  PatientCreate,
  PatientDetailResponse,
  PatientResponse,
  PatientUpdate,
  ReportCreate,
  ReportProcessResponse,
  ReportResponse,
  ReportStatusUpdate,
  ReportUploadResponse,
  VerificationRequest,
} from '../types/api.ts'
import { ApiError } from '../types/api.ts'

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : typeof window !== 'undefined' && window.location?.origin
      ? ''
      : 'http://localhost:8000'
).replace(/\/+$/, '')

// ============================================================================
// Core API Client
// ============================================================================

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  /**
   * Core request method with error handling and type safety
   */
  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = `${this.baseUrl}${cleanEndpoint}`
    const {
      method = 'GET',
      body,
      headers = {},
      isMultipart = false,
    } = options

    // Prepare request headers
    const requestHeaders: Record<string, string> = {
      ...headers,
    }

    // Only set Content-Type for non-multipart requests with a body
    // For multipart, let the browser set it with the boundary
    if (body !== undefined && !isMultipart) {
      requestHeaders['Content-Type'] = 'application/json'
    }

    // Prepare request body
    let requestBody: BodyInit | undefined
    if (body !== undefined) {
      if (isMultipart) {
        requestBody = body as BodyInit // FormData
      } else {
        requestBody = JSON.stringify(body)
      }
    }

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
      })

      // Handle non-2xx responses
      if (!response.ok) {
        const errorData = await this.parseError(response)
        throw new ApiError(
          errorData.message || `Request failed with status ${response.status}`,
          response.status,
          errorData.code,
          errorData.details
        )
      }

      // Parse JSON response
      const data = await response.json()
      return data as T
    } catch (error) {
      // Re-throw ApiError instances
      if (error instanceof ApiError) {
        throw error
      }

      // Handle network errors and other exceptions
      throw new ApiError(
        'Network error or unable to connect to server',
        undefined,
        'NETWORK_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  /**
   * Parse error response from backend
   */
  private async parseError(response: Response): Promise<{
    message: string
    code?: string
    details?: unknown
  }> {
    try {
      const data = await response.json()
      let message = 'An error occurred'
      if (typeof data.detail === 'string') {
        message = data.detail
      } else if (Array.isArray(data.detail)) {
        message = data.detail
          .map((err: { msg?: string; loc?: (string | number)[] }) => {
            const field = err.loc ? err.loc.slice(1).join('.') : ''
            return field ? `${field}: ${err.msg || 'Invalid'}` : (err.msg || JSON.stringify(err))
          })
          .join('; ')
      } else if (data.message && typeof data.message === 'string') {
        message = data.message
      }

      return {
        message,
        code: typeof data.code === 'string' ? data.code : undefined,
        details: data.details || (typeof data.detail !== 'string' ? data.detail : undefined),
      }
    } catch {
      return {
        message: `HTTP ${response.status}: ${response.statusText || 'Error'}`,
      }
    }
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body })
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body })
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      isMultipart: true,
    })
  }
}

// ============================================================================
// API Client Instance
// ============================================================================

const apiClient = new ApiClient(API_BASE_URL)

// ============================================================================
// Patient API Methods
// ============================================================================

/**
 * Create a new patient
 */
export async function createPatient(patient: PatientCreate): Promise<PatientResponse> {
  return apiClient.post<PatientResponse>('/api/patients', patient)
}

/**
 * List all patients with optional search
 */
export async function listPatients(search?: string): Promise<PatientResponse[]> {
  const trimmed = search?.trim()
  const params = trimmed ? `?search=${encodeURIComponent(trimmed)}` : ''
  return apiClient.get<PatientResponse[]>(`/api/patients${params}`)
}

/**
 * Get patient by ID
 */
export async function getPatient(patientId: number): Promise<PatientDetailResponse> {
  return apiClient.get<PatientDetailResponse>(`/api/patients/${patientId}`)
}

/**
 * Update patient information
 */
export async function updatePatient(
  patientId: number,
  updates: PatientUpdate
): Promise<PatientResponse> {
  return apiClient.put<PatientResponse>(`/api/patients/${patientId}`, updates)
}

// ============================================================================
// Report API Methods
// ============================================================================

/**
 * Create report metadata for a patient
 */
export async function createReport(
  patientId: number,
  report: ReportCreate
): Promise<ReportResponse> {
  return apiClient.post<ReportResponse>(`/api/patients/${patientId}/reports`, report)
}

/**
 * List reports for a specific patient
 */
export async function listPatientReports(patientId: number): Promise<ReportResponse[]> {
  return apiClient.get<ReportResponse[]>(`/api/patients/${patientId}/reports`)
}

/**
 * Get individual report by ID
 */
export async function getReport(reportId: number): Promise<ReportResponse> {
  return apiClient.get<ReportResponse>(`/api/reports/${reportId}`)
}

/**
 * Update report processing status
 */
export async function updateReportStatus(
  reportId: number,
  status: ReportStatusUpdate
): Promise<ReportResponse> {
  return apiClient.put<ReportResponse>(`/api/reports/${reportId}/status`, status)
}

/**
 * Upload PDF report for a patient
 */
export async function uploadReport(
  patientId: number,
  file: File,
  reportDate?: string
): Promise<ReportUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  if (reportDate && reportDate.trim()) {
    formData.append('report_date', reportDate.trim())
  }

  return apiClient.upload<ReportUploadResponse>(
    `/api/patients/${patientId}/reports/upload`,
    formData
  )
}

// ============================================================================
// Processing API Methods
// ============================================================================

/**
 * Process report (trigger AI extraction, provenance validation, classification)
 */
export async function processReport(reportId: number): Promise<ReportProcessResponse> {
  return apiClient.post<ReportProcessResponse>(`/api/reports/${reportId}/process`)
}

/**
 * Get lab results for a specific report
 */
export async function getReportLabResults(reportId: number): Promise<LabResultResponse[]> {
  return apiClient.get<LabResultResponse[]>(`/api/reports/${reportId}/lab-results`)
}

/**
 * Get all lab results across all reports for a specific patient (for timeline & conflicts)
 */
export async function listPatientLabResults(patientId: number): Promise<LabResultResponse[]> {
  return apiClient.get<LabResultResponse[]>(`/api/patients/${patientId}/lab-results`)
}

/**
 * Submit human clinical verification on an extracted lab result
 */
export async function verifyLabResult(
  resultId: number,
  payload: VerificationRequest
): Promise<LabResultResponse> {
  return apiClient.post<LabResultResponse>(`/api/lab-results/${resultId}/verify`, payload)
}

// ============================================================================
// Export API Client
// ============================================================================

export { apiClient, ApiClient, ApiError }
export type { ApiRequestOptions, ApiResponse }