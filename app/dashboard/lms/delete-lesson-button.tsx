'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteLesson } from './actions'

export function DeleteLessonButton({ lessonId }: { lessonId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteLesson(lessonId)
      if (result?.error) {
        setError(result.error)
        setConfirming(false)
      } else {
        router.push('/dashboard/lms')
      }
    })
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-sm">
        {error && <span className="text-danger-text text-xs">{error}</span>}
        <span className="text-text-secondary">Delete this lesson?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-danger-text hover:underline disabled:opacity-50"
        >
          {isPending ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-text-secondary hover:underline"
        >
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm text-danger-text border border-red-200 bg-danger-bg/40 rounded-lg px-4 py-2 hover:bg-danger-bg transition-colors"
    >
      Delete lesson
    </button>
  )
}
