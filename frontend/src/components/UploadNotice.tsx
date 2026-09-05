import { FileUp, X } from 'lucide-react'

interface UploadNoticeProps {
  open: boolean
  onClose: () => void
}

export function UploadNotice({ open, onClose }: UploadNoticeProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label="Dismiss upload notice"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="upload-title"
        className="relative z-10 m-4 w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileUp size={18} className="text-teal" />
            <h2 id="upload-title" className="text-[15px] font-semibold text-ink">
              Upload Report
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-body hover:bg-paper"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-slate-body">
          Report intake, extraction, and storage are not connected in this
          milestone. This workspace is a frontend preview with synthetic data
          only.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-teal px-4 text-[13px] font-medium text-surface"
        >
          Continue reviewing demo data
        </button>
      </div>
    </div>
  )
}
