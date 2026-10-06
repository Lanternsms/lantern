'use client'

import { useState, useTransition } from 'react'
import { getViewUrl } from './actions'

export default function ViewButton({ documentId }: { documentId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleClick() {
    setError('')
    startTransition(async () => {
      const result = await getViewUrl(documentId)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
      }
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="border border-border bg-surface hover:bg-surface-muted text-text-primary rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
      >
        {isPending ? 'Opening…' : 'View'}
      </button>
      {error && <p className="text-xs text-danger-text mt-1">{error}</p>}
    </div>
  )
}
