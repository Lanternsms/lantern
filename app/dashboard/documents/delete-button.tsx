'use client'

import { useState, useTransition } from 'react'
import { deleteDocument } from './actions'

export default function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span className="text-xs flex items-center gap-2">
        <button
          className="text-danger hover:underline"
          disabled={isPending}
          onClick={() => startTransition(() => deleteDocument(id))}
        >
          Confirm delete
        </button>
        <button className="text-text-secondary hover:underline" onClick={() => setConfirming(false)}>
          Cancel
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