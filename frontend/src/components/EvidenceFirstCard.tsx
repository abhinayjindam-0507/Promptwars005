import {
  ArrowRight,
  BadgeCheck,
  FileText,
  ScanLine,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const steps: { label: string; icon: LucideIcon }[] = [
  { label: 'Document', icon: FileText },
  { label: 'Extraction', icon: ScanLine },
  { label: 'Validation', icon: ShieldCheck },
  { label: 'Human Review', icon: UserRound },
  { label: 'Verified Record', icon: BadgeCheck },
]

export function EvidenceFirstCard() {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-ink text-surface">
      <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[1.1fr_1.4fr] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-mist/70">
            Evidence-First Intelligence
          </p>
          <h2 className="mt-3 font-display text-[26px] leading-tight tracking-tight">
            Every extracted result remains traceable to its source report.
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-teal-mist/80">
            MedLens does not present a conclusion as a fact. It organizes what
            a document said, where it said it, and whether a reviewer has
            confirmed the mapping.
          </p>
        </div>

        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-0">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <li key={step.label} className="flex items-center">
                <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/6">
                    <Icon size={18} strokeWidth={1.6} className="text-teal-mist" />
                  </span>
                  <span className="mt-2 text-[11px] font-medium leading-tight text-teal-mist">
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 ? (
                  <ArrowRight
                    size={14}
                    className="mx-0.5 hidden shrink-0 text-white/25 sm:block"
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
