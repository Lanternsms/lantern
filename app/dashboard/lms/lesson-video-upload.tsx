'use client'

// NOTE: This upload is NOT resumable. Large files that are interrupted
// will fail and must be re-uploaded from scratch.

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { attachLessonVideo } from './actions'

const MAX_BYTES = 500 * 1024 * 1024 // 500 MB
const ALLOWED_TYPES = ['video/mp4', 'video/webm']

interface LessonVideoUploadProps {
  lessonId: string
  schoolId: string
  currentVideoPath: string | null
}

export function LessonVideoUpload({ lessonId, schoolId, currentVideoPath }: LessonVideoUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hiddenVideoRef = useRef<HTMLVideoElement>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setSuccess(false)
    const selected = e.target.files?.[0] ?? null

    if (!selected) { setFile(null); return }

    if (!ALLOWED_TYPES.includes(selected.type)) {
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
  }

  function getDuration(f: File): Promise<number | null> {
    return new Promise((resolve) => {
      const video = hiddenVideoRef.current
      if (!video) return resolve(null)
      const objectUrl = URL.createObjectURL(f)
      video.src = objectUrl
      video.onloadedmetadata = () => {
        const dur = isFinite(video.duration) ? Math.round(video.duration) : null
        URL.revokeObjectURL(objectUrl)
        resolve(dur)
      }
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(null)
      }
    })
  }

  async function handleUpload() {
    if (!file) return
    setError(null)
    setSuccess(false)
    setUploading(true)
    setProgress(0)

    const ext = file.type === 'video/webm' || file.name.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4'
    const storagePath = `${schoolId}/${lessonId}.${ext}`
    const duration = await getDuration(file)

    const supabase = createClient()

    // Upload directly from the browser with upsert so replacing a video works
    const { error: uploadErr } = await supabase.storage
      .from('lms-lessons')
      .upload(storagePath, file, {
        upsert: true,
        contentType: file.type,
      })

    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      return
    }

    // Simulate a progress finish (Supabase JS SDK doesn't expose per-chunk progress yet)
    setProgress(100)

    startTransition(async () => {
      const result = await attachLessonVideo(lessonId, storagePath, duration)
      setUploading(false)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Hidden video element to read duration metadata */}
      <video ref={hiddenVideoRef} className="hidden" />

      {currentVideoPath && (
        <p className="text-xs text-text-secondary">
          Current file: <span className="font-mono text-text-primary">{currentVideoPath}</span>
          <br />
          Uploading a new file will replace it.
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          id="lms-video-input"
          accept="video/mp4,video/webm"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-sm border border-border rounded-lg px-4 py-2 text-text-primary hover:bg-surface-muted transition-colors"
        >
          {file ? 'Change file' : 'Choose video'}
        </button>
        {file && (
          <span className="text-sm text-text-secondary truncate max-w-xs">
            {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-success-text bg-success-bg rounded-lg px-3 py-2">
          Video uploaded successfully.
        </p>
      )}

      {uploading && (
        <div className="space-y-1">
          <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-text-secondary">Uploading… {progress}%</p>
        </div>
      )}

      {file && !uploading && (
        <button
          type="button"
          onClick={handleUpload}
          className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors"
        >
          Upload video
        </button>
      )}
    </div>
  )
}
