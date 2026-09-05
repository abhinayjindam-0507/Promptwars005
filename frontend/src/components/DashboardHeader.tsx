import { AlertCircle, RefreshCw, Upload } from 'lucide-react'
import { DEMO_NOTICE } from '../data/mockData'
import type { ConnectionStatus } from '../hooks/useDashboardData'
import { DemoBadge } from './DemoBadge'

interface DashboardHeaderProps {
  onUpload: () => void
  connectionStatus?: ConnectionStatus
  isLive?: boolean
  onRetry?: () => void
  loading?: boolean
  errorMessage?: string | null
}

export function DashboardHeader({
  onUpload,
  connectionStatus = 'checking',
  isLive = false,
  onRetry,
  loading = false,
  errorMessage,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {connectionStatus === 'connected' ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-teal/25 bg-teal-mist px-2.5 py-0.5 text-[11px] font-medium text-teal"
              title="Connected to FastAPI backend at http://localhost:8000"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden="true" />
              Connected
            </span>
          ) : connectionStatus === 'unavailable' ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-amber/25 bg-amber-mist px-2.5 py-0.5 text-[11px] font-medium text-amber"
              title="Backend service is unreachable. Using synthetic demo data."
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />
              Backend Unavailable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-0.5 text-[11px] font-medium text-slate-body">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-body" aria-hidden="true" />
              Connecting...
            </span>
          )}

          {isLive ? (
            <span className="inline-flex items-center rounded-sm border border-teal/30 bg-teal-mist px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
              Live Data
            </span>
          ) : (
            <DemoBadge />
          )}

          <span className="text-[11px] text-slate-body">
            {isLive
              ? 'Patient records and documents loaded from backend database.'
              : DEMO_NOTICE}
          </span>

          {connectionStatus === 'unavailable' && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-teal underline underline-offset-2 hover:text-teal-bright disabled:opacity-50"
              aria-label="Retry connecting to backend server"
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              {loading ? 'Retrying...' : 'Retry'}
            </button>
          ) : null}
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

        {errorMessage && connectionStatus === 'unavailable' ? (
          <div
            role="status"
            className="mt-3 flex items-center justify-between rounded-lg border border-amber/30 bg-amber-mist/50 px-3.5 py-2 text-[12px] text-ink"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0 text-amber" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={loading}
                className="ml-3 shrink-0 rounded border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink hover:bg-paper disabled:opacity-50"
              >
                Reconnect
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onUpload}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-teal px-4 text-[13.5px] font-medium text-surface shadow-[0_1px_0_rgb(255_255_255_/_0.15)_inset] transition-colors hover:bg-teal-bright"
        aria-label="Upload new medical report"
      >
        <Upload size={16} strokeWidth={1.75} />
        Upload Report
      </button>
    </div>
  )
}
