/**
 * TypeScript types corresponding to backend FastAPI response schemas.
 * Source of truth: backend/app/schemas/
 */

// ============================================================================
// Enums and Status Types
// ============================================================================

export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export type LabResultStatus = 
  | 'NORMAL' 
  | 'ABNORMAL' 
  | 'CRITICAL' 
  | 'INCONCLUSIVE' 
  | 'PENDING' 
  | 'LOW' 
  | 'HIGH' 
  | 'UNDETERMINED'

export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'FLAGGED' | 'REJECTED'

export type ExtractionStatus = 
  | 'PENDING' 
  | 'TEXT_EXTRACTED' 
  | 'OCR_REQUIRED' 
  | 'AI_EXTRACTION_COMPLETED'

// ============================================================================
// Patient Types
// ============================================================================

export interface PatientBase {
  patient_code: string
  name: string
  age: number
  sex: string
  symptoms?: string
  existing_conditions?: string
  allergies?: string
  medications?: string
}

export interface PatientCreate extends PatientBase {}

export interface PatientUpdate {
  patient_code?: string
  name?: string
  age?: number
  sex?: string
  symptoms?: string
  existing_conditions?: string
  allergies?: string
  medications?: string
}

export interface PatientResponse {
  id: number
  patient_code: string
  name: string
  age?: number
  sex?: string
  symptoms?: string
  existing_conditions?: string
  allergies?: string
  medications?: string
  created_at: string // ISO datetime string
  updated_at: string // ISO datetime string
}

export interface PatientDetailResponse extends PatientResponse {
  reports: ReportResponse[]
}

// Aliases matching domain entities
export type Patient = PatientResponse
export type PatientListItem = PatientResponse

// ============================================================================
// Report Types
// ============================================================================

export interface ReportCreate {
  file_name: string
  report_date?: string // YYYY-MM-DD format
  processing_status?: ProcessingStatus
}

export interface ReportStatusUpdate {
  processing_status: ProcessingStatus
}

export interface ReportResponse {
  id: number
  patient_id: number
  file_name: string
  report_date?: string // YYYY-MM-DD format
  uploaded_at: string // ISO datetime string
  processing_status: ProcessingStatus
  page_count?: number
  extracted_text_available: boolean
  extraction_status?: string
}

export interface ReportUploadResponse {
  report_id: number
  patient_id: number
  file_name: string
  report_date?: string // YYYY-MM-DD format
  processing_status: ProcessingStatus
  extraction_status: string
  page_count: number
  extracted_text_available: boolean
  uploaded_at: string // ISO datetime string
  message: string
}

export interface ReportProcessResponse {
  report_id: number
  patient_id: number
  processing_status: ProcessingStatus
  extraction_status: string
  persisted_results_count: number
  provenance_passed_count: number
  provenance_flagged_count: number
  lab_results: LabResultResponse[]
  message: string
}

// Aliases matching domain entities
export type Report = ReportResponse
export type ReportSummary = ReportResponse
export type ReportUpload = ReportUploadResponse
export type ReportProcess = ReportProcessResponse

// ============================================================================
// Lab Result Types
// ============================================================================

export interface LabResultResponse {
  id: number
  patient_id: number
  report_id?: number
  test_name: string
  value: string
  numeric_value?: number
  unit?: string
  reference_low?: number
  reference_high?: number
  reference_range_text?: string
  status: LabResultStatus
  observation?: string
  test_date?: string // YYYY-MM-DD format
  extraction_confidence?: number
  verification_status: VerificationStatus
  source_page?: number
  source_text?: string
  created_at: string // ISO datetime string
}

// Alias matching domain entity
export type LabResult = LabResultResponse

// ============================================================================
// API Error Types
// ============================================================================

export class ApiError extends Error {
  status?: number
  code?: string
  details?: unknown

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export { ApiError as ApiErrorClass }

// ============================================================================
// Request/Response Wrapper Types
// ============================================================================

export interface ApiResponse<T> {
  data: T
  status: number
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  headers?: Record<string, string>
  isMultipart?: boolean
}