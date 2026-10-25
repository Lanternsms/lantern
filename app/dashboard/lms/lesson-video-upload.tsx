'use client'

import { useState, useRef, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as tus from 'tus-js-client'
import { createClient } from '@/lib/supabase/client'
import { attachLessonVideo } from './actions'
import {
  inspectVideoFile,
  type VideoInspectionResult,
  formatFileSize,
} from './video-inspect'

const MAX_BYTES = 500 * 1024 * 1024 // 500 MB
const ALLOWED_TYPES = ['video/mp4', 'video/webm']

function getResumableUploadEndpoint(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  try {
    const parsed = new URL(supabaseUrl)
    const match = parsed.hostname.match(/^([a-z0-9_-]+)\.supabase\.co$/i)
    if (match) {
      return `https://${match[1]}.storage.supabase.co/upload/resumable`
    }
  } catch {
    // fallback
  }
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/upload/resumable`
}

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return 'calculating…'
  if (seconds < 60) return '< 1m'
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}

export interface LessonVideoUploadProps {
  lessonId: string
  schoolId: string
  currentVideoPath?: string | null
  hasExistingVideo?: boolean
  schoolStorageUsed?: string | null
}

export function LessonVideoUpload({
  lessonId,
  schoolId,
  currentVideoPath,
  hasExistingVideo,
  schoolStorageUsed,
}: LessonVideoUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [inspection, setInspection] = useState<VideoInspectionResult | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [overrideCodecWarning, setOverrideCodecWarning] = useState(false)

  // Upload states
  const [uploading, setUploading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState<number>(0)
  const [bytesUploaded, setBytesUploaded] = useState<number>(0)
  const [bytesTotal, setBytesTotal] = useState<number>(0)
  const [speedStr, setSpeedStr] = useState<string>('')
  const [etaStr, setEtaStr] = useState<string>('')
  const [retryMessage, setRetryMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const tusUploadRef = useRef<tus.Upload | null>(null)
  const isStartingUploadRef = useRef(false)
  const speedStatsRef = useRef<{ lastBytes: number; lastTime: number }>({
    lastBytes: 0,
    lastTime: 0,
  })

  const [, startTransition] = useTransition()
  const router = useRouter()

  // beforeunload warning while uploading
  useEffect(() => {
    if (!uploading) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [uploading])

  // Inspect file on selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setSuccess(false)
    setInspection(null)
    setOverrideCodecWarning(false)
    setProgress(0)
    setBytesUploaded(0)
    setBytesTotal(0)
    setSpeedStr('')
    setEtaStr('')
    setRetryMessage(null)

    const selected = e.target.files?.[0] ?? null
    if (!selected) {
      setFile(null)
      return
    }

    if (!ALLOWED_TYPES.includes(selected.type) && !selected.name.match(/\.(mp4|webm)$/i)) {
      setError('Only MP4 and WebM video files are accepted.')
      setFile(null)
      return
    }

    if (selected.size > MAX_BYTES) {
      setError('File must be under 500 MB.')
      setFile(null)
      return
    }

    setFile(selected)
    setInspecting(true)

    try {
      const res = await inspectVideoFile(selected)
      setInspection(res)
    } catch {
      setInspection({
        valid: false,
        duration: 0,
        width: 0,
        height: 0,
        codec: 'other',
        audioCodec: null,
        summary: `${(selected.size / (1024 * 1024)).toFixed(1)} MB`,
        blockingError: 'Could not inspect video file.',
        warning: null,
        canOverride: false,
        requiresOverride: false,
      })
    } finally {
      setInspecting(false)
    }
  }

  const cancelUpload = useCallback(() => {
    if (tusUploadRef.current) {
      tusUploadRef.current.abort()
      tusUploadRef.current = null
    }
    setUploading(false)
    setIsPaused(false)
    setProgress(0)
    setBytesUploaded(0)
    setBytesTotal(0)
    setSpeedStr('')
    setEtaStr('')
    setRetryMessage(null)
    isStartingUploadRef.current = false
  }, [])

  const pauseUpload = useCallback(() => {
    if (tusUploadRef.current && uploading && !isPaused) {
      tusUploadRef.current.abort()
      setIsPaused(true)
    }
  }, [uploading, isPaused])

  const resumeUpload = useCallback(() => {
    if (tusUploadRef.current && isPaused) {
      setIsPaused(false)
      speedStatsRef.current = { lastBytes: bytesUploaded, lastTime: Date.now() }
      tusUploadRef.current.start()
    }
  }, [isPaused, bytesUploaded])

  const startUpload = async () => {
    if (!file || !inspection) return
    if (isStartingUploadRef.current || uploading) return
    if (inspection.blockingError && (!inspection.canOverride || !overrideCodecWarning)) return

    isStartingUploadRef.current = true
    setError(null)
    setSuccess(false)
    setUploading(true)
    setIsPaused(false)
    setRetryMessage(null)
    setProgress(0)

    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setError('Authentication expired. Please log in again.')
      setUploading(false)
      isStartingUploadRef.current = false
      return
    }

    const ext = file.type === 'video/webm' || file.name.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4'
    const storagePath = `${schoolId}/${lessonId}.${ext}`
    const endpoint = getResumableUploadEndpoint()

    speedStatsRef.current = {
      lastBytes: 0,
      lastTime: Date.now(),
    }

    const upload = new tus.Upload(file, {
      endpoint,
      chunkSize: 6 * 1024 * 1024, // 6 MB chunk size required
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'true',
      },
      metadata: {
        bucketName: 'lms-lessons',
        objectName: storagePath,
        contentType: file.type || 'video/mp4',
        cacheControl: '3600',
      },
      onBeforeRequest: async (req) => {
        const {
          data: { session: freshSession },
        } = await supabase.auth.getSession()
        if (freshSession?.access_token) {
          req.setHeader('authorization', `Bearer ${freshSession.access_token}`)
        }
      },
      onShouldRetry: (_err, retryAttempt, options) => {
        const delays = options.retryDelays || [0, 3000, 5000, 10000, 20000]
        const delayMs = delays[retryAttempt] ?? 0
        const delaySec = Math.round(delayMs / 1000)
        setRetryMessage(`Connection lost, retrying in ${delaySec}s…`)
        return true
      },
      onProgress: (uploaded, total) => {
        setRetryMessage(null)
        setBytesUploaded(uploaded)
        setBytesTotal(total)
        const pct = Math.round((uploaded / total) * 100)
        setProgress(pct)

        // Speed & ETA calculation
        const now = Date.now()
        const timeDiff = (now - speedStatsRef.current.lastTime) / 1000
        if (timeDiff >= 0.8) {
          const bytesDiff = uploaded - speedStatsRef.current.lastBytes
          const speed = bytesDiff / timeDiff
          speedStatsRef.current = { lastBytes: uploaded, lastTime: now }

          if (speed > 0) {
            setSpeedStr(`${(speed / (1024 * 1024)).toFixed(1)} MB/s`)
            const remaining = total - uploaded
            setEtaStr(formatEta(remaining / speed))
          }
        }
      },
      onError: (err) => {
        setError(err.message || 'Video upload failed.')
        setUploading(false)
        setIsPaused(false)
        setRetryMessage(null)
        isStartingUploadRef.current = false
      },
      onSuccess: () => {
        setProgress(100)
        setRetryMessage(null)

        startTransition(async () => {
          const res = await attachLessonVideo(
            lessonId,
            storagePath,
            inspection.duration,
            file.size,
            inspection.codec,
            inspection.width,
            inspection.height
          )

          setUploading(false)
          setIsPaused(false)
          isStartingUploadRef.current = false
          tusUploadRef.current = null

          if (res?.error) {
            setError(res.error)
          } else {
            setSuccess(true)
            setFile(null)
            setInspection(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
            router.refresh()
          }
        })
      },
    })

    tusUploadRef.current = upload

    // Check previous upload for this same file and resume if available
    try {
      const previousUploads = await upload.findPreviousUploads()
      if (previousUploads && previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0])
      }
    } catch (err) {
      console.warn('findPreviousUploads error:', err)
    }

    upload.start()
    isStartingUploadRef.current = false
  }

  const isBlocked =
    !!inspection?.blockingError && (!inspection.canOverride || !overrideCodecWarning)

  return (
    <div className="space-y-4">
      {/* Existing file / storage info */}
      <div className="space-y-1">
        {(currentVideoPath || hasExistingVideo) && (
          <p className="text-xs text-text-secondary">
            {currentVideoPath ? (
              <>
                Current file: <span className="font-mono text-text-primary">{currentVideoPath}</span>
              </>
            ) : (
              'An existing lesson video is uploaded.'
            )}
            <br />
            Uploading a new file will replace it.
          </p>
        )}
        {schoolStorageUsed && (
          <p className="text-xs text-text-muted">{schoolStorageUsed}</p>
        )}
      </div>

      {/* File input bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          id="lms-video-input"
          accept="video/mp4,video/webm"
          disabled={uploading}
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm border border-border rounded-lg px-4 py-2 text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50"
        >
          {file ? 'Change file' : 'Choose video'}
        </button>

        {file && !inspecting && (
          <span className="text-sm text-text-secondary truncate max-w-xs">
            {file.name} ({formatFileSize(file.size)})
          </span>
        )}

        {inspecting && (
          <span className="inline-flex items-center gap-2 text-xs text-text-muted">
            <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            Analyzing video format…
          </span>
        )}
      </div>

      {/* Format Inspection Summary & Warnings */}
      {inspection && !inspecting && (
        <div className="space-y-2">
          {/* Summary badge line */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-muted/60 border border-border text-xs text-text-secondary">
            <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="font-medium text-text-primary">{inspection.summary}</span>
          </div>

          {/* Blocking error banner */}
          {inspection.blockingError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-start gap-2 text-xs text-red-800">
                <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="space-y-1">
                  <p className="font-medium">{inspection.blockingError}</p>
                </div>
              </div>

              {/* Override checkbox for hevc/prores/av1 */}
              {inspection.canOverride && (
                <label className="flex items-center gap-2 pt-1 text-xs text-red-900 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideCodecWarning}
                    onChange={(e) => setOverrideCodecWarning(e.target.checked)}
                    disabled={uploading}
                    className="rounded border-red-300 text-primary focus:ring-primary/20"
                  />
                  <span>Upload anyway (I know this may not play for everyone)</span>
                </label>
              )}
            </div>
          )}

          {/* Audio warning banner */}
          {inspection.warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{inspection.warning}</span>
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Success banner */}
      {success && (
        <p className="text-sm text-success-text bg-success-bg rounded-lg px-3 py-2">
          Video uploaded and attached successfully.
        </p>
      )}

      {/* Resumable Uploading Progress & Controls */}
      {uploading && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>
              {isPaused ? (
                <span className="font-semibold text-amber-600">Paused</span>
              ) : retryMessage ? (
                <span className="font-semibold text-amber-600">{retryMessage}</span>
              ) : (
                'Uploading…'
              )}
            </span>
            <span className="font-medium text-text-primary">{progress}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-surface-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isPaused ? 'bg-amber-500' : 'bg-primary'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Upload stats */}
          <div className="flex items-center justify-between text-xs text-text-muted flex-wrap gap-2">
            <span>
              {formatFileSize(bytesUploaded)} / {formatFileSize(bytesTotal)}
            </span>
            {!isPaused && !retryMessage && speedStr && (
              <span>
                {speedStr} &bull; {etaStr ? `Remaining: ${etaStr}` : ''}
              </span>
            )}
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            {!isPaused ? (
              <button
                type="button"
                onClick={pauseUpload}
                className="text-xs px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-text-secondary transition-colors"
              >
                Pause
              </button>
            ) : (
              <button
                type="button"
                onClick={resumeUpload}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover font-medium transition-colors"
              >
                Resume
              </button>
            )}

            <button
              type="button"
              onClick={cancelUpload}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons before upload */}
      {file && !uploading && !inspecting && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={startUpload}
            disabled={isBlocked}
            className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-5 py-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upload video
          </button>
        </div>
      )}
    </div>
  )
}
