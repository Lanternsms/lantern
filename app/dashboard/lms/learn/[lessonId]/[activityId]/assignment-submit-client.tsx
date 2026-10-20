/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAssignmentUploadUrl, submitAssignment, getBriefDownloadUrl } from '@/app/dashboard/lms/activities/actions'

interface AssignmentSubmitClientProps {
  activity: any
  submission: any | null
  studentId: string
  lessonId: string
  studentName: string
}

export function AssignmentSubmitClient({
  activity,
  submission,
  studentId,
  lessonId,
  studentName
}: AssignmentSubmitClientProps) {
  const router = useRouter()
  const isMarked = submission?.status === 'marked'
  const isSubmitted = submission?.status === 'submitted'

  const [textResponse, setTextResponse] = useState(submission?.text_response || '')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [downloadingBrief, setDownloadingBrief] = useState(false)
  const [briefError, setBriefError] = useState<string | null>(null)

  const handleDownloadBrief = async () => {
    setBriefError(null)
    setDownloadingBrief(true)
    try {
      const res = await getBriefDownloadUrl({ activityId: activity.id, studentId })
      if (res.error || !res.url) {
        setBriefError(res.error || 'Failed to download assignment document.')
      } else {
        window.open(res.url, '_blank')
      }
    } catch (err: any) {
      setBriefError(err?.message || 'Failed to download assignment document.')
    } finally {
      setDownloadingBrief(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!textResponse.trim() && !selectedFile && !submission?.attachment_path) {
      setError('Please provide either a written response or an attached file.')
      return
    }

    setLoading(true)

    try {
      let attachmentPath = submission?.attachment_path || null

      if (selectedFile) {
        // Step 1: get signed upload URL
        const uploadInfo = await getAssignmentUploadUrl(
          activity.id,
          studentId,
          selectedFile.name,
          selectedFile.type,
          selectedFile.size
        )

        if (uploadInfo.error || !uploadInfo.signedUrl) {
          throw new Error(uploadInfo.error || 'Failed to get upload authorization.')
        }

        // Step 2: Upload file directly to Supabase storage
        const uploadRes = await fetch(uploadInfo.signedUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: {
            'Content-Type': selectedFile.type
          }
        })

        if (!uploadRes.ok) {
          throw new Error(`Upload failed with status ${uploadRes.status}`)
        }

        attachmentPath = uploadInfo.path
      }

      // Step 3: Record assignment submission in database
      const subRes = await submitAssignment(activity.id, studentId, {
        textResponse: textResponse.trim() || undefined,
        attachmentPath: attachmentPath || undefined
      })

      if (subRes.error) {
        throw new Error(subRes.error)
      }

      setSuccess('Your assignment has been submitted successfully!')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to submit assignment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Assignment for {studentName}
          </span>
          <span className="text-xs font-bold text-text-primary">
            Max Score: {activity.max_score} marks
          </span>
        </div>

        <h1 className="text-xl font-bold text-text-primary">{activity.title}</h1>

        {activity.due_at && (
          <p className="text-xs text-text-secondary">
            Due:{' '}
            <strong className="text-text-primary">
              {new Date(activity.due_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </strong>
          </p>
        )}

        {activity.instructions && (
          <div className="mt-2 rounded-xl bg-surface-muted/50 border border-border p-4 text-xs text-text-secondary whitespace-pre-wrap">
            {activity.instructions}
          </div>
        )}
      </div>

      {/* Assignment Document Card */}
      {activity.attachment_name && (
        <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Assignment Document (PDF)
              </div>
              <div className="text-sm font-semibold text-text-primary truncate">{activity.attachment_name}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadBrief}
            disabled={downloadingBrief}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-primary hover:bg-surface-muted transition-colors shrink-0 disabled:opacity-50"
          >
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloadingBrief ? 'Opening...' : 'Download Document'}
          </button>
        </div>
      )}

      {briefError && (
        <div className="rounded-xl border border-danger-bg bg-danger-bg/20 p-3 text-xs text-danger-text">
          {briefError}
        </div>
      )}

      {/* MARKED VIEW */}
      {isMarked && (
        <div className="rounded-2xl border border-success-bg/80 bg-surface p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success-bg text-success-text">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <h2 className="text-base font-bold text-text-primary">Assignment Marked</h2>
            </div>
            <div className="text-xl font-extrabold text-primary">
              {submission.score} <span className="text-xs font-normal text-text-secondary">/ {activity.max_score} marks</span>
            </div>
          </div>

          {submission.feedback && (
            <div className="rounded-xl bg-surface-muted border border-border p-4 space-y-1">
              <div className="text-xs font-semibold text-text-primary">Teacher Feedback:</div>
              <p className="text-xs text-text-secondary whitespace-pre-wrap">{submission.feedback}</p>
            </div>
          )}

          <div className="text-xs text-text-secondary">
            Marked on {new Date(submission.marked_at).toLocaleDateString()}
            {submission.is_late && <span className="ml-2 font-semibold text-amber-500">(Late Submission)</span>}
          </div>

          {/* Submitted content preview */}
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-xs font-medium text-text-secondary">Your Submission:</span>
            {submission.text_response && (
              <div className="rounded-xl border border-border bg-surface-muted/30 p-3 text-xs text-text-primary whitespace-pre-wrap">
                {submission.text_response}
              </div>
            )}
            {submission.attachment_path && submission.downloadUrl && (
              <a
                href={submission.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-primary hover:bg-surface-muted transition-colors"
              >
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Submitted File
              </a>
            )}
          </div>
        </div>
      )}

      {/* SUBMISSION FORM (IF NOT MARKED) */}
      {!isMarked && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-semibold text-text-primary">
              {isSubmitted ? 'Edit Your Submission' : 'Submit Your Assignment'}
            </h2>
            {isSubmitted && (
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                Submitted &bull; Awaiting Marking
              </span>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-danger-bg bg-danger-bg/20 p-3 text-xs text-danger-text">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-success-bg bg-success-bg/20 p-3 text-xs text-success-text">
              {success}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Written Response (Optional if uploading file)
            </label>
            <textarea
              rows={5}
              value={textResponse}
              onChange={e => setTextResponse(e.target.value)}
              placeholder="Type your response or answers here..."
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-xs text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Attach Document / File (PDF, Word, or image up to 20MB)
            </label>
            <input
              type="file"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-medium file:text-white hover:file:bg-primary/90"
            />
            {submission?.attachment_path && !selectedFile && (
              <p className="text-[11px] text-text-secondary mt-1">
                Currently attached file on record. Choose a new file to replace it.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Link
              href={`/dashboard/lms/learn/${lessonId}?student=${studentId}`}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
            >
              &larr; Back to Activities
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Uploading & Submitting...' : isSubmitted ? 'Save Changes' : 'Submit Assignment'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
