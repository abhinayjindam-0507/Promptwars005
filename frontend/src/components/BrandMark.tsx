interface BrandMarkProps {
  compact?: boolean
  tone?: 'dark' | 'light'
}

export function BrandMark({ compact = false, tone = 'dark' }: BrandMarkProps) {
  const titleClass = tone === 'dark' ? 'text-surface' : 'text-ink'
  const subtitleClass =
    tone === 'dark' ? 'text-teal-mist/70' : 'text-slate-body'
  const markClass =
    tone === 'dark'
      ? 'border-teal-mist/40 bg-teal-bright/15'
      : 'border-teal/20 bg-teal-mist'
  const ringClass =
    tone === 'dark' ? 'border-teal-mist/50' : 'border-teal/25'
  const coreClass = tone === 'dark' ? 'bg-teal-mist' : 'bg-teal'

  return (
    <div className="flex items-center gap-3">
      <span
        className={`relative grid h-9 w-9 place-items-center rounded-full border ${markClass}`}
        aria-hidden="true"
      >
        <span className={`absolute inset-1.5 rounded-full border ${ringClass}`} />
        <span className={`h-2 w-2 rounded-full ${coreClass}`} />
      </span>
      <div className={compact ? 'min-w-0' : ''}>
        <p className={`font-display text-[17px] leading-none tracking-tight ${titleClass}`}>
          MedLens
        </p>
        <p
          className={`mt-1 text-[10px] font-medium uppercase tracking-[0.18em] ${subtitleClass}`}
        >
          Clinical intelligence
        </p>
      </div>
    </div>
  )
}
