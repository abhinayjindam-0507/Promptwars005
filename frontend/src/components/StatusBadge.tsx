import type { VerificationStatus } from '../types'
import { statusLabel, statusStyles } from '../lib/labels'

interface StatusBadgeProps {
  status: VerificationStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${statusStyles[status]}`}
    >
      {statusLabel(status)}
    </span>
  )
}
