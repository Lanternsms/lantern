'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createNotesUploadUrl,
  attachLessonNotes,
  removeLessonNotes,
  setNotesDownloadable,
  reextractNotes,
} from '../actions'
import { formatFileSize } from '../video-inspect'
import { FileText, Upload, RefreshCw, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react'

const MAX_PDF_BYTES = 25 * 1024 * 1024 // 25 MB

interface LessonNotesUploadProps {
  lessonId: string
  notesPath: string | null
  notesName: string | null
  notesSizeBytes: number | null
  notesUploadedAt: string | null
  notesDownloadable: boolean
  extractionStatus: 'pending' | 'ready' | 'scanned' | 'too_long' | 'failed' | null
  extractionError?: string | null
}

export function LessonNotesUpload({
  lessonId,
  notesPath,
  notesName,
  notesSizeBytes,
  notesUploadedAt,
  notesDownloadable,
  extractionStatus,
  extractionError,
}: LessonNotesUploadProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  const [downloadable, setDownloadable] = useState(notesDownloadable)
  const [isReplacing, setIsReplacing] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Handle Downloadable Toggle
  const handleToggleDownloadable = (newVal: boolean) => {
    setDownloadable(newVal)
    startTransition(async () => {
      const res = await setNotesDownloadable(lessonId, newVal)
      if (res?.error) {
        setDownloadable(!newVal)
        setUploadError(res.error)
      } else {
        router.refresh()
      }
    })
  }

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setUploadError('Only PDF files are allowed (.pdf).')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > MAX_PDF_BYTES) {
      setUploadError(`File is too large (${formatFileSize(file.size)}). Maximum allowed is 25 MB.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setSelectedFile(file)
  }

  // Start Upload
  const handleStartUpload = async () => {
    if (!selectedFile) return
    setUploadError(null)
    setUploadProgress(0)

    try {
      // 1. Get signed upload URL from server
      const urlRes = await createNotesUploadUrl(lessonId)
      if (!urlRes || !urlRes.ok || !urlRes.signedUrl || !urlRes.path) {
        setUploadError(urlRes?.error || 'Failed to prepare upload URL.')
        setUploadProgress(null)
        return
      }

      const { signedUrl, path } = urlRes

      // 2. Direct upload via XHR to track progress and allow cancellation
      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.min(99, Math.round((evt.loaded / evt.total) * 100))
          setUploadProgress(percent)
        }
      }

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100)
          // 3. Attach notes record on server
          startTransition(async () => {
            const attachRes = await attachLessonNotes(lessonId, path, selectedFile.name, downloadable)
            if (attachRes?.error) {
              setUploadError(attachRes.error)
              setUploadProgress(null)
            } else {
              setSelectedFile(null)
              setUploadProgress(null)
              setIsReplacing(false)
              router.refresh()
            }
          })
        } else {
          setUploadError(`Upload failed with server status ${xhr.status}.`)
          setUploadProgress(null)
        }
      }

      xhr.onerror = () => {
        setUploadError('Network error during upload. Please check your connection and retry.')
        setUploadProgress(null)
      }

      xhr.onabort = () => {
        setUploadProgress(null)
        setUploadError('Upload cancelled.')
      }

      xhr.open('PUT', signedUrl)
      xhr.setRequestHeader('Content-Type', 'application/pdf')
      xhr.send(selectedFile)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setUploadProgress(null)
    }
  }

  // Cancel Upload
  const handleCancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort()
      xhrRef.current = null
    }
    setUploadProgress(null)
  }

  // Handle Remove Notes
  const handleRemoveNotes = () => {
    if (!confirm('Are you sure you want to remove the notes for this lesson? The PDF and extracted text will be permanently deleted.')) {
      return
    }
    startTransition(async () => {
      const res = await removeLessonNotes(lessonId)
      if (res?.error) {
        setUploadError(res.error)
      } else {
        setIsReplacing(false)
        setSelectedFile(null)
        router.refresh()
      }
    })
  }

  // Handle Re-extraction
  const handleReextract = () => {
    setUploadError(null)
    startTransition(async () => {
      const res = await reextractNotes(lessonId)
      if (res?.error) {
        setUploadError(res.error)
      } else {
        router.refresh()
      }
    })
  }

  const hasNotes = Boolean(notesPath)
  const isUploading = uploadProgress !== null

  return (
    <div className="space-y-4">
      {uploadError && (
        <div className="text-xs text-danger-text bg-danger-bg border border-red-200 rounded-lg p-3">
          {uploadError}
        </div>
      )}

      {hasNotes && !isReplacing ? (
        <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-4">
          {/* File details */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {notesName || 'lesson-notes.pdf'}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {notesSizeBytes ? formatFileSize(notesSizeBytes) : 'PDF Document'}
                  {notesUploadedAt && ` • Uploaded ${new Date(notesUploadedAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsReplacing(true)
                  setSelectedFile(null)
                }}
                disabled={isPending}
                className="text-xs font-medium text-text-primary hover:text-primary border border-border bg-surface rounded-lg px-2.5 py-1.5 transition-colors"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemoveNotes}
                disabled={isPending}
                className="text-xs font-medium text-danger-text hover:bg-danger-bg border border-red-200 rounded-lg p-1.5 transition-colors"
                title="Remove notes"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* AI extraction status banner */}
          <div className="pt-3 border-t border-border flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {extractionStatus === 'ready' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Ready for the AI tutor
                </span>
              )}
              {extractionStatus === 'scanned' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  <AlertTriangle size={14} className="text-amber-600" />
                  This PDF looks scanned, so the AI tutor cannot read it. Upload a text-based PDF (export from Word or Google Docs)
                </span>
              )}
              {extractionStatus === 'too_long' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  <AlertTriangle size={14} className="text-amber-600" />
                  Too long for the AI tutor
                </span>
              )}
              {extractionStatus === 'failed' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                  <AlertCircle size={14} className="text-red-600" />
                  Could not read this PDF
                </span>
              )}
              {extractionStatus === 'pending' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <Loader2 size={14} className="animate-spin text-blue-600" />
                  Extracting text for AI tutor…
                </span>
              )}
            </div>

            {(extractionStatus === 'failed' || extractionStatus === 'scanned') && (
              <button
                type="button"
                onClick={handleReextract}
                disabled={isPending}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
                Try again
              </button>
            )}
          </div>

          {/* Downloadable Toggle */}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-primary">Students can download</p>
              <p className="text-[11px] text-text-secondary">Allow enrolled learners and guardians to download this PDF</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={downloadable}
                disabled={isPending}
                onChange={(e) => handleToggleDownloadable(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {isReplacing ? 'Replace Lesson Notes' : 'Upload Lesson Notes'}
              </p>
              <p className="text-xs text-text-secondary">PDF format only (up to 25 MB)</p>
            </div>
            {isReplacing && (
              <button
                type="button"
                onClick={() => {
                  setIsReplacing(false)
                  setSelectedFile(null)
                  setUploadError(null)
                }}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                Cancel replace
              </button>
            )}
          </div>

          {!selectedFile ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id={`notes-upload-${lessonId}`}
              />
              <label
                htmlFor={`notes-upload-${lessonId}`}
                className="flex flex-col items-center justify-center p-6 border border-dashed border-border rounded-lg bg-surface-muted/20 hover:bg-surface-muted/50 cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Upload size={18} />
                </div>
                <p className="text-xs font-semibold text-text-primary">Click to select PDF document</p>
                <p className="text-[11px] text-text-secondary mt-0.5">Maximum size: 25 MB</p>
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-muted/30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={18} className="text-red-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{selectedFile.name}</p>
                    <p className="text-[11px] text-text-secondary">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    Change
                  </button>
                )}
              </div>

              {isUploading && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Downloadable Toggle while uploading/before saving */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs font-medium text-text-primary">Students can download</p>
                  <p className="text-[11px] text-text-secondary">Allow learners to download this document</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={downloadable}
                    disabled={isUploading}
                    onChange={(e) => setDownloadable(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleStartUpload}
                  disabled={isUploading || isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Uploading ({uploadProgress}%)
                    </>
                  ) : (
                    'Save Lesson Notes'
                  )}
                </button>
                {isUploading && (
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="text-xs text-danger-text hover:underline px-2 py-1.5"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
