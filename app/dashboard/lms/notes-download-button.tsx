'use client'

import { useState, useTransition } from 'react'
import { getNotesDownloadUrl } from './actions'

interface NotesDownloadButtonProps {
  lessonId: string
  notesSizeBytes?: number | null
  studentId?: string
  className?: string
  label?: string
}

function formatFileSize(bytes: number): string {
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
  const [error, setError] = useState<string | null>(null)

  function handleDownload() {
    setError(null)
    startTransition(async () => {
      const res = await getNotesDownloadUrl(lessonId, studentId)
      if ('error' in res) {
        setError('Unable to download notes. Please try again.')
        return
      }
      // Open in new tab — triggers download due to signed URL `download` param
      window.open(res.url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50"
      >
        {isPending ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Getting link…
          </>
        ) : (
          <>
            {label ?? 'Notes (PDF)'}
            {notesSizeBytes != null && (
              <span className="text-text-muted">· {formatFileSize(notesSizeBytes)}</span>
            )}
          </>
        )}
      </button>
      {error && (
        <p className="mt-1 text-[11px] text-danger-text">{error}</p>
      )}
    </div>
  )
}
