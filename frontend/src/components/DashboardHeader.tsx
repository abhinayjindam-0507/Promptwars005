import { Upload } from 'lucide-react'
import { DEMO_NOTICE } from '../data/mockData'
import { DemoBadge } from './DemoBadge'

interface DashboardHeaderProps {
  onUpload: () => void
}

export function DashboardHeader({ onUpload }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <div className="mb-3 flex items-center gap-2">
          <DemoBadge />
          <span className="text-[11px] text-slate-body">{DEMO_NOTICE}</span>
        </div>
        <h1 className="font-display text-[34px] leading-none tracking-tight text-ink sm:text-[40px]">
          Good morning
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-body">
          MedLens turns medical reports into structured, reviewable information.
          Every field stays linked to the source document so clinicians can
          inspect, verify, and resolve conflicts without treating the system as
          a diagnostic engine.
        </p>
      </div>
      <button
        type="button"
        onClick={onUpload}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-teal px-4 text-[13.5px] font-medium text-surface shadow-[0_1px_0_rgb(255_255_255_/_0.15)_inset] transition-colors hover:bg-teal-bright"
      >
        <Upload size={16} strokeWidth={1.75} />
        Upload Report
      </button>
    </div>
  )
}
