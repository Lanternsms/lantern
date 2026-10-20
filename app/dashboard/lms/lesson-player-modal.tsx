'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getLessonVideoUrl } from './actions'

interface LessonPlayerModalProps {
  lessonId: string
  title: string
  label?: string
  studentId?: string
  size?: 'md' | 'lg'
}

export function LessonPlayerModal({
  lessonId,
  title,
  label = 'Preview',
  studentId,
  size = 'md',
}: LessonPlayerModalProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retried, setRetried] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const fetchUrl = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getLessonVideoUrl(lessonId, studentId)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setUrl(result.url ?? null)
    }
  }, [lessonId, studentId])

  function openModal() {
    setOpen(true)
    setUrl(null)
    setError(null)
    setRetried(false)
    fetchUrl()
  }

  function closeModal() {
    setOpen(false)
    videoRef.current?.pause()
    setUrl(null)
    setError(null)
  }

  // Esc key to close
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handleVideoError() {
    if (!retried) {
      setRetried(true)
      // Retry once with a fresh signed URL
      fetchUrl()
    } else {
      setError('The video failed to load. Please try again.')
      setUrl(null)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 2.5L11 7L3 11.5V2.5Z" fill="currentColor" />
        </svg>
        {label}
      </button>

      {open && (
        <div
          ref={backdropRef}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70"
          onClick={(e) => {
            if (e.target === backdropRef.current) closeModal()
          }}
        >
          <div className={`relative w-full ${size === 'lg' ? 'max-w-6xl' : 'max-w-4xl'} bg-black rounded-2xl overflow-hidden shadow-2xl`}>
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-3 bg-gradient-to-b from-black/80 to-transparent">
              <p className="text-white text-sm font-medium truncate pr-4">{title}</p>
              <button
                onClick={closeModal}
                aria-label="Close video player"
                className="text-white/70 hover:text-white transition-colors shrink-0"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Video area */}
            <div className="aspect-video w-full flex items-center justify-center bg-black">
              {loading && (
                <div className="flex flex-col items-center gap-3">
                  <span className="inline-block h-10 w-10 rounded-full border-4 border-white/20 border-t-white animate-[lantern-spin_1s_linear_infinite]" />
                  <p className="text-white/60 text-sm">Loading video…</p>
                </div>
              )}
              {error && !loading && (
                <div className="text-center space-y-3 px-8">
                  <p className="text-white/80 text-sm">{error}</p>
                  <button
                    onClick={() => { setRetried(false); fetchUrl() }}
                    className="text-white/60 text-xs hover:text-white transition-colors underline"
                  >
                    Try again
                  </button>
                </div>
              )}
              {url && !loading && (
                <video
                  ref={videoRef}
                  src={url}
                  controls
                  controlsList="nodownload"
                  playsInline
                  autoPlay
                  className="w-full h-full"
                  onError={handleVideoError}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
