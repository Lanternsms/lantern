'use client'

import { useState, useTransition } from 'react'
import { deleteAnnouncement } from './actions'

export default function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span className="text-xs flex items-center gap-2">
        <span className="text-text-secondary">Delete this?</span>
        <button
          className="text-danger hover:underline"
          disabled={isPending}
          onClick={() => startTransition(() => deleteAnnouncement(id))}
        >
          Yes
        </button>
        <button className="text-text-secondary hover:underline" onClick={() => setConfirming(false)}>
          No
        </button>
      </span>
    )
  }

  return (
    <button className="text-xs text-danger hover:underline" onClick={() => setConfirming(true)}>
      Delete
    </button>
  )
}