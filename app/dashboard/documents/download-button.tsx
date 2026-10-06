'use client'

import { useState, useTransition } from 'react'
import { getDownloadUrl } from './actions'

export default function DownloadButton({ documentId }: { documentId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleClick() {
    setError('')
    startTransition(async () => {
      const result = await getDownloadUrl(documentId)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.url) {
        const a = document.createElement('a')
        a.href = result.url
        if (result.filename) {
          a.download = result.filename
        }
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    })
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="bg-primary hover:bg-primary-hover text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition-colors cursor-pointer"
      >
        {isPending ? 'Preparing…' : 'Download'}
      </button>
      {error && <p className="text-xs text-danger-text mt-1">{error}</p>}
    </div>
  )
}