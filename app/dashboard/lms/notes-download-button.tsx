'use client'

import { useState, useTransition } from 'react'
import { getNotesDownloadUrl, type NotesDownloadFailureReason } from './actions'

interface NotesDownloadButtonProps {
  lessonId: string
  notesSizeBytes?: number | null
  studentId?: string
  className?: string
  label?: string
}

function formatFileSize(bytes: number | null | undefined): string | null {
  if (bytes == null || bytes <= 0) return null
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export function NotesDownloadButton({
  lessonId,
  notesSizeBytes,
  studentId,
  className,
  label,
}: NotesDownloadButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorReason, setErrorReason] = useState<NotesDownloadFailureReason | null>(null)

  function triggerDownload(url: string) {
    try {
      const a = document.createElement('a')
      a.href = url
      a.rel = 'noopener noreferrer'
      // appending to body ensures maximum compatibility across iOS Safari & Android Chrome
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      window.location.assign(url)
    }
  }

  function handleDownload() {
    setErrorMsg(null)
    setErrorReason(null)

    startTransition(async () => {
      const res = await getNotesDownloadUrl(lessonId, studentId)

      if (!res.ok) {
        setErrorMsg(res.error)
        setErrorReason(res.reason)
        return
      }

      triggerDownload(res.url)
    })
  }

  const rawSize = formatFileSize(notesSizeBytes)
  const sizeLabel = rawSize ? `PDF, ${rawSize}` : 'PDF'

  return (
    <div className={`inline-flex flex-col items-start ${className ?? ''}`}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isPending}
        aria-label={label ?? `Download notes (${sizeLabel})`}
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-medium text-text-primary hover:bg-surface-muted active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none"
      >
        {isPending ? (
          <>
            <svg
              className="w-4 h-4 animate-spin text-primary shrink-0"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="truncate">Getting link…</span>
          </>
        ) : (
          <>
            {/* Download file icon */}
            <svg
              className="w-4 h-4 text-primary shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="truncate">{label ?? 'Download notes'}</span>
            <span className="text-[11px] text-text-muted font-normal shrink-0">
              ({sizeLabel})
            </span>
          </>
        )}
      </button>

      {errorMsg && (
        <div className="mt-1.5 flex items-center flex-wrap gap-1.5 text-xs text-danger-text max-w-xs">
          <span>{errorMsg}</span>
          {errorReason === 'try_again' && (
            <button
              type="button"
              onClick={handleDownload}
              className="font-semibold underline hover:opacity-80 active:opacity-60 cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
