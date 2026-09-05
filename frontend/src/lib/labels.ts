import type { ReportKind, VerificationStatus } from '../types'

export function statusLabel(status: VerificationStatus): string {
  switch (status) {
    case 'verified':
      return 'Verified'
    case 'pending_review':
      return 'Pending review'
    case 'conflict':
      return 'Conflict'
    case 'in_validation':
      return 'In validation'
  }
}

export function reportKindLabel(kind: ReportKind): string {
  switch (kind) {
    case 'lab_panel':
      return 'Lab panel'
    case 'imaging_summary':
      return 'Imaging summary'
    case 'discharge_note':
      return 'Discharge note'
  }
}

export const statusStyles: Record<VerificationStatus, string> = {
  verified: 'bg-teal-mist text-teal',
  pending_review: 'bg-amber-mist text-amber',
  conflict: 'bg-rose-mist text-rose',
  in_validation: 'bg-paper-deep text-ink-soft',
}
