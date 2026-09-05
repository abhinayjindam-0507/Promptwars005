import type { LabResultStatus } from '../types/api'
import { labStatusLabel } from '../lib/reportWorkflow'

interface LabStatusBadgeProps {
  status: LabResultStatus | string
}

const statusStyles: Record<string, string> = {
  LOW: 'border-amber/30 bg-amber-mist text-amber',
  NORMAL: 'border-teal/30 bg-teal-mist text-teal',
  HIGH: 'border-rose/30 bg-rose-mist text-rose',
  UNDETERMINED: 'border-line bg-paper-deep text-ink-soft',
}

export function LabStatusBadge({ status }: LabStatusBadgeProps) {
  const label = labStatusLabel(status)
  const style = statusStyles[status] || 'border-line bg-paper text-ink-soft'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${style}`}
    >
      <span className="font-medium uppercase" aria-hidden="true">
        {status === 'LOW' ? '↓' : status === 'HIGH' ? '↑' : status === 'NORMAL' ? '•' : '?'}
      </span>
      <span>{label}</span>
    </span>
  )
}
