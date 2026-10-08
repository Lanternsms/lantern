'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { searchStudents } from '../actions'

export default function StudentSearch({ selectedStudent }: { selectedStudent: any }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string) {
    setQuery(value)
    if (value.trim().length < 2) { setResults([]); return }
    startTransition(async () => { setResults(await searchStudents(value)) })
  }

  return (
    <div className="space-y-2 max-w-md">
      <label className="block text-xs text-text-secondary mb-1">Search student by name or admission no.</label>
      <input value={query} onChange={(e) => handleChange(e.target.value)} placeholder="Type to search…" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface" />
      {isPending && <p className="text-xs text-text-secondary">Searching…</p>}
      {results.length > 0 && (
        <div className="bg-surface border border-border rounded-lg divide-y divide-border">
          {results.map((s) => (
            <button key={s.id} onClick={() => { router.push(`/dashboard/fees/record?studentId=${s.id}`); setResults([]); setQuery('') }} className="w-full text-left px-3 py-2 text-sm hover:bg-background">
              {s.first_name} {s.last_name} <span className="text-text-secondary text-xs">({s.admission_no})</span>
            </button>
          ))}
        </div>
      )}
      {selectedStudent && (
        <p className="text-sm text-text-primary">
          Selected: <span className="font-medium">{selectedStudent.first_name} {selectedStudent.last_name}</span> ({selectedStudent.admission_no})
        </p>
      )}
    </div>
  )
}