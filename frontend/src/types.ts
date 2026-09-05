export type NavId =
  | 'dashboard'
  | 'patients'
  | 'reports'
  | 'timeline'
  | 'verification'
  | 'settings'

export type VerificationStatus =
  | 'verified'
  | 'pending_review'
  | 'conflict'
  | 'in_validation'

export type ReportKind = 'lab_panel' | 'imaging_summary' | 'discharge_note'

export interface WorkspaceStat {
  id: string
  label: string
  value: number
  hint: string
}

export interface DemoPatient {
  code: string
  age: number
  sex: string
  latestReportDate: string
  labResultCount: number
  verificationStatus: VerificationStatus
}

export interface DemoReport {
  id: string
  title: string
  patientCode: string
  kind: ReportKind
  receivedAt: string
  status: VerificationStatus
}

export interface VerificationItem {
  id: string
  patientCode: string
  summary: string
  reason: string
  status: VerificationStatus
  queuedAt: string
}

export interface ActivityEvent {
  id: string
  title: string
  detail: string
  occurredAt: string
}

export interface DemoTrendPoint {
  label: string
  value: number
}
