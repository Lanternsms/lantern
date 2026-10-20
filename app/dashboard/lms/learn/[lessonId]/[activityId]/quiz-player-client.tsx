/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { startQuizAttempt, submitQuizAttempt } from '@/app/dashboard/lms/activities/actions'

interface QuizPlayerClientProps {
  activityId: string
  studentId: string
  lessonId: string
  studentName: string
}

export function QuizPlayerClient({
  activityId,
  studentId,
  lessonId,
  studentName
}: QuizPlayerClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submission, setSubmission] = useState<any | null>(null)
  const [activity, setActivity] = useState<any | null>(null)
  const [questions, setQuestions] = useState<any[]>([])

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any | null>(null)

  // Timer
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)
  const autoSubmitted = useRef(false)

  // Fetch or start attempt
  const initAttempt = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await startQuizAttempt(activityId, studentId)
      if (res.error) {
        setError(res.error)
      } else {
        setSubmission(res.submission)
        setActivity(res.activity)
        setQuestions(res.questions || [])

        // If resuming an attempt with existing answers
        if (res.submission?.answers) {
          setSelectedAnswers(res.submission.answers)
        }

        // Set up timer if time_limit_minutes is set
        if (res.activity?.time_limit_minutes) {
          const startedAt = new Date(res.submission.started_at).getTime()
          const limitMs = res.activity.time_limit_minutes * 60 * 1000
          const elapsedMs = Date.now() - startedAt
          const leftSec = Math.max(0, Math.floor((limitMs - elapsedMs) / 1000))
          setSecondsRemaining(leftSec)
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to start quiz attempt.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initAttempt()
  }, [activityId, studentId])

  // Timer effect
  useEffect(() => {
    if (secondsRemaining === null || result || submitting) return

    if (secondsRemaining <= 0) {
      if (!autoSubmitted.current && submission?.id) {
        autoSubmitted.current = true
        handleSubmit()
      }
      return
    }

    const interval = setInterval(() => {
      setSecondsRemaining(prev => (prev !== null && prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(interval)
  }, [secondsRemaining, result, submitting, submission])

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (result || submitting) return
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionIdx
    }))
  }

  const handleSubmit = async () => {
    if (!submission?.id || submitting || result) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await submitQuizAttempt(submission.id, selectedAnswers)
      if (res.error) {
        setError(res.error)
      } else {
        setResult(res)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit quiz attempt.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetake = () => {
    setResult(null)
    setSelectedAnswers({})
    autoSubmitted.current = false
    initAttempt()
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em]" />
        <p className="mt-3 text-xs text-text-secondary">Loading quiz questions...</p>
      </div>
    )
  }

  if (error && !submission) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger-text">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-text-primary">Unable to Start Quiz</h2>
        <p className="text-xs text-text-secondary max-w-sm mx-auto">{error}</p>
        <div>
          <Link
            href={`/dashboard/lms/learn/${lessonId}?student=${studentId}`}
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90"
          >
            &larr; Back to Lesson Activities
          </Link>
        </div>
      </div>
    )
  }

  // RESULT VIEW
  if (result) {
    const questionsWithFeedback = result.questions || []
    const percentage = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success-text">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h2 className="text-xl font-bold text-text-primary">Quiz Completed!</h2>
            <p className="text-xs text-text-secondary mt-1">Student: {studentName}</p>
          </div>

          <div className="inline-block rounded-2xl bg-surface-muted border border-border px-8 py-4">
            <div className="text-3xl font-extrabold text-primary">
              {result.score} <span className="text-lg font-normal text-text-secondary">/ {result.maxScore}</span>
            </div>
            <div className="text-xs font-medium text-text-secondary mt-1">
              Score: {percentage}%
              {result.isLate && <span className="ml-2 text-amber-500 font-semibold">(Submitted Late)</span>}
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Link
              href={`/dashboard/lms/learn/${lessonId}?student=${studentId}`}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors"
            >
              &larr; Back to Activities
            </Link>
            <button
              type="button"
              onClick={handleRetake}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
            >
              Take Quiz Again
            </button>
          </div>
        </div>

        {/* Answer Breakdown (if show_answers is enabled) */}
        {result.showAnswers && questionsWithFeedback.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Review Answers & Explanations</h3>
            {questionsWithFeedback.map((q: any, idx: number) => {
              const studentAnswer = selectedAnswers[q.id]
              const isCorrect = studentAnswer !== undefined && studentAnswer === q.correct_index

              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border p-5 bg-surface space-y-3 ${
                    isCorrect ? 'border-success-bg/80' : 'border-danger-bg/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-secondary">#{idx + 1}</span>
                      <p className="text-sm font-semibold text-text-primary">{q.prompt}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        isCorrect
                          ? 'bg-success-bg text-success-text'
                          : 'bg-danger-bg text-danger-text'
                      }`}
                    >
                      {isCorrect ? `+${q.marks} marks` : `0 / ${q.marks} marks`}
                    </span>
                  </div>

                  {/* Options */}
                  <div className="space-y-1.5 pl-4">
                    {q.options.map((opt: string, optIdx: number) => {
                      const isStudentSelected = studentAnswer === optIdx
                      const isCorrectOption = q.correct_index === optIdx

                      let badge = ''
                      let borderClass = 'border-border bg-surface'
                      if (isCorrectOption) {
                        borderClass = 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                        badge = ' (Correct Answer)'
                      } else if (isStudentSelected && !isCorrectOption) {
                        borderClass = 'border-red-500 bg-red-500/10 text-red-800 dark:text-red-200'
                        badge = ' (Your Answer)'
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${borderClass}`}
                        >
                          <span>
                            <strong className="mr-2">{String.fromCharCode(65 + optIdx)}.</strong>
                            {opt}
                          </span>
                          {badge && <span className="font-semibold text-[11px]">{badge}</span>}
                        </div>
                      )
                    })}
                  </div>

                  {q.explanation && (
                    <div className="rounded-lg bg-surface-muted p-3 text-xs text-text-secondary border border-border">
                      <strong className="text-text-primary">Explanation: </strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // QUESTION PLAYER VIEW
  const answeredCount = Object.keys(selectedAnswers).length
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="space-y-6">
      {/* Quiz Header Bar */}
      <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface/95 p-4 backdrop-blur shadow-sm">
        <div>
          <h2 className="text-base font-bold text-text-primary">{activity?.title}</h2>
          <p className="text-xs text-text-secondary">
            Question {answeredCount} of {questions.length} answered
          </p>
        </div>

        <div className="flex items-center gap-3">
          {secondsRemaining !== null && (
            <div
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                secondsRemaining < 60
                  ? 'border-danger-bg bg-danger-bg/20 text-danger-text animate-pulse'
                  : 'border-border bg-surface-muted text-text-primary'
              }`}
            >
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatTime(secondsRemaining)} remaining</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger-bg bg-danger-bg/20 p-3 text-xs text-danger-text">
          {error}
        </div>
      )}

      {/* Questions list */}
      <div className="space-y-5">
        {questions.map((q, qIdx) => (
          <div
            key={q.id}
            className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {qIdx + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Question {qIdx + 1}
                </span>
              </div>
              <span className="text-xs font-medium text-text-secondary">
                {q.marks} mark{q.marks === 1 ? '' : 's'}
              </span>
            </div>

            <p className="text-sm font-medium text-text-primary leading-relaxed">
              {q.prompt}
            </p>

            <div className="space-y-2 pt-1">
              {(q.options || []).map((opt: string, optIdx: number) => {
                const isSelected = selectedAnswers[q.id] === optIdx
                return (
                  <label
                    key={optIdx}
                    className={`flex items-center gap-3 rounded-xl border p-3.5 text-sm cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary'
                        : 'border-border bg-surface hover:bg-surface-muted/50 text-text-primary'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question_${q.id}`}
                      checked={isSelected}
                      onChange={() => handleSelectOption(q.id, optIdx)}
                      className="h-4 w-4 text-primary focus:ring-primary border-border"
                    />
                    <span className="text-xs font-bold text-text-secondary w-5">
                      {String.fromCharCode(65 + optIdx)}.
                    </span>
                    <span className="flex-1">{opt}</span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5">
        <span className="text-xs text-text-secondary">
          Completed {answeredCount} of {questions.length} questions
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Answers & Finish'}
        </button>
      </div>
    </div>
  )
}
