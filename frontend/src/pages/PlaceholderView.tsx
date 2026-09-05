import type { NavId } from '../types'

const copy: Record<Exclude<NavId, 'dashboard'>, { title: string; body: string }> = {
  patients: {
    title: 'Patients',
    body: 'Patient records will appear here once intake and indexing are connected. This milestone is dashboard-only.',
  },
  reports: {
    title: 'Reports',
    body: 'A full report library will list source documents and extracted fields. Upload and extraction are not enabled yet.',
  },
  timeline: {
    title: 'Timeline',
    body: 'The longitudinal view will assemble verified events per patient code. Demo activity is currently shown on the dashboard.',
  },
  verification: {
    title: 'Verification',
    body: 'Reviewers will confirm or reject extracted values against source pages. The dashboard queue is a preview of that workflow.',
  },
  settings: {
    title: 'Settings',
    body: 'Workspace preferences and reviewer roles will live here. Authentication is not part of this milestone.',
  },
}

interface PlaceholderViewProps {
  navId: Exclude<NavId, 'dashboard'>
}

export function PlaceholderView({ navId }: PlaceholderViewProps) {
  const page = copy[navId]

  return (
    <section className="max-w-xl rounded-xl border border-line bg-surface p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-body">
        Coming later
      </p>
      <h1 className="mt-2 font-display text-[32px] tracking-tight text-ink">
        {page.title}
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-slate-body">
        {page.body}
      </p>
    </section>
  )
}
