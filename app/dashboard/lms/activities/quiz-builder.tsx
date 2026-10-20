/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveQuizQuestions } from './actions'

interface QuestionItem {
  id?: string
  position: number
  prompt: string
  options: string[]
  correct_index: number
  marks: number
  explanation?: string
}

interface QuizBuilderProps {
  activityId: string
  initialQuestions?: QuestionItem[]
  readOnly?: boolean
  hasSubmissions?: boolean
}

export function QuizBuilder({
  activityId,
  initialQuestions = [],
  readOnly = false,
  hasSubmissions = false
}: QuizBuilderProps) {
  const router = useRouter()
  const [questions, setQuestions] = useState<QuestionItem[]>(() => {
    if (initialQuestions.length > 0) {
      return initialQuestions.map((q, idx) => ({
        ...q,
        position: idx + 1,
        options: q.options && q.options.length >= 2 ? q.options : ['Option 1', 'Option 2']
      }))
    }
    return [
      {
        position: 1,
        prompt: '',
        options: ['', ''],
        correct_index: 0,
        marks: 1,
        explanation: ''
      }
    ]
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)

  const handleAddQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        position: prev.length + 1,
        prompt: '',
        options: ['', ''],
        correct_index: 0,
        marks: 1,
        explanation: ''
      }
    ])
  }

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return
    setQuestions(prev => {
      const next = prev.filter((_, i) => i !== idx)
      return next.map((q, i) => ({ ...q, position: i + 1 }))
    })
  }

  const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= questions.length) return
    setQuestions(prev => {
      const copy = [...prev]
      const temp = copy[idx]
      copy[idx] = copy[targetIdx]
      copy[targetIdx] = temp
      return copy.map((q, i) => ({ ...q, position: i + 1 }))
    })
  }

  const handlePromptChange = (idx: number, text: string) => {
    setQuestions(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], prompt: text }
      return copy
    })
  }

  const handleMarksChange = (idx: number, marks: number) => {
    setQuestions(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], marks: Math.max(1, marks) }
      return copy
    })
  }

  const handleExplanationChange = (idx: number, exp: string) => {
    setQuestions(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], explanation: exp }
      return copy
    })
  }

  const handleOptionChange = (qIdx: number, optIdx: number, val: string) => {
    setQuestions(prev => {
      const copy = [...prev]
      const opts = [...copy[qIdx].options]
      opts[optIdx] = val
      copy[qIdx] = { ...copy[qIdx], options: opts }
      return copy
    })
  }

  const handleAddOption = (qIdx: number) => {
    if (questions[qIdx].options.length >= 6) return
    setQuestions(prev => {
      const copy = [...prev]
      copy[qIdx] = { ...copy[qIdx], options: [...copy[qIdx].options, ''] }
      return copy
    })
  }

  const handleRemoveOption = (qIdx: number, optIdx: number) => {
    if (questions[qIdx].options.length <= 2) return
    setQuestions(prev => {
      const copy = [...prev]
      const opts = copy[qIdx].options.filter((_, i) => i !== optIdx)
      let correct = copy[qIdx].correct_index
      if (correct === optIdx) correct = 0
      else if (correct > optIdx) correct -= 1
      copy[qIdx] = { ...copy[qIdx], options: opts, correct_index: correct }
      return copy
    })
  }

  const handleCorrectOptionChange = (qIdx: number, optIdx: number) => {
    setQuestions(prev => {
      const copy = [...prev]
      copy[qIdx] = { ...copy[qIdx], correct_index: optIdx }
      return copy
    })
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(null)

    // Validation
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.prompt.trim()) {
        setError(`Question ${i + 1} has an empty prompt.`)
        return
      }
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].trim()) {
          setError(`Question ${i + 1}, Option ${j + 1} cannot be empty.`)
          return
        }
      }
    }

    setSaving(true)
    try {
      const res = await saveQuizQuestions(activityId, questions)
      if (res.error) {
        setError(res.error)
      } else {
        setSuccess(`Saved ${res.count} question(s) successfully! Total marks: ${res.totalMarks}`)
        router.refresh()
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save questions.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
        <div>
          <div className="text-sm font-semibold text-text-primary">
            Quiz Questions ({questions.length})
          </div>
          <div className="text-xs text-text-secondary">
            Total Points: <span className="font-bold text-text-primary">{totalMarks}</span> marks
          </div>
        </div>

        {!readOnly && !hasSubmissions && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAddQuestion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors"
            >
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Question
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save All Questions'}
            </button>
          </div>
        )}
      </div>

      {hasSubmissions && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          Submissions have already been received for this quiz. Questions and point values can no longer be edited.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger-bg bg-danger-bg/20 p-3 text-xs text-danger-text">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-success-bg bg-success-bg/20 p-3 text-xs text-success-text">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q, qIdx) => (
          <div
            key={qIdx}
            className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4"
          >
            {/* Question Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {qIdx + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Question {qIdx + 1}
                </span>
              </div>

              {!readOnly && !hasSubmissions && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(qIdx, 'up')}
                    disabled={qIdx === 0}
                    className="rounded p-1 text-text-secondary hover:bg-surface-muted disabled:opacity-30"
                    title="Move up"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(qIdx, 'down')}
                    disabled={qIdx === questions.length - 1}
                    className="rounded p-1 text-text-secondary hover:bg-surface-muted disabled:opacity-30"
                    title="Move down"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIdx)}
                      className="rounded p-1 text-danger-text hover:bg-danger-bg/20 ml-2"
                      title="Delete question"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Prompt input */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Question Prompt <span className="text-danger-text">*</span>
              </label>
              <textarea
                rows={2}
                value={q.prompt}
                disabled={readOnly || hasSubmissions}
                onChange={e => handlePromptChange(qIdx, e.target.value)}
                placeholder="What is the chemical formula for water?"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-70"
              />
            </div>

            {/* Options list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">
                  Multiple Choice Options (Select the correct answer)
                </span>
                <span className="text-[11px] text-text-secondary">
                  {q.options.length} / 6 options
                </span>
              </div>

              {q.options.map((opt, optIdx) => (
                <div key={optIdx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct_${qIdx}`}
                    checked={q.correct_index === optIdx}
                    disabled={readOnly || hasSubmissions}
                    onChange={() => handleCorrectOptionChange(qIdx, optIdx)}
                    className="h-4 w-4 text-primary focus:ring-primary border-border"
                    title="Mark as correct answer"
                  />
                  <span className="text-xs font-semibold text-text-secondary w-5">
                    {String.fromCharCode(65 + optIdx)}.
                  </span>
                  <input
                    type="text"
                    value={opt}
                    disabled={readOnly || hasSubmissions}
                    onChange={e => handleOptionChange(qIdx, optIdx, e.target.value)}
                    placeholder={`Option ${optIdx + 1}`}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-70 ${
                      q.correct_index === optIdx
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-surface'
                    }`}
                  />
                  {!readOnly && !hasSubmissions && q.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(qIdx, optIdx)}
                      className="text-text-secondary hover:text-danger-text p-1"
                      title="Remove option"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              {!readOnly && !hasSubmissions && q.options.length < 6 && (
                <button
                  type="button"
                  onClick={() => handleAddOption(qIdx)}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  + Add option
                </button>
              )}
            </div>

            {/* Marks & Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-border/50">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Marks
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={q.marks}
                  disabled={readOnly || hasSubmissions}
                  onChange={e => handleMarksChange(qIdx, Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-70"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Explanation (Shown to learners after submission if answers are revealed)
                </label>
                <input
                  type="text"
                  value={q.explanation || ''}
                  disabled={readOnly || hasSubmissions}
                  onChange={e => handleExplanationChange(qIdx, e.target.value)}
                  placeholder="Optional hint or explanation of why this answer is correct"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-70"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!readOnly && !hasSubmissions && questions.length > 0 && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save All Questions'}
          </button>
        </div>
      )}
    </div>
  )
}
