'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { Icon } from '@/components/icon'
import { searchStudents } from '../actions'

type Found = { id: string; first_name: string; last_name: string; admission_no: string }

export default function StudentSearch({ selectedStudent }: { selectedStudent: Found | null }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Found[]>([])
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string) {
    setQuery(value)
    if (value.trim().length < 2) { setResults([]); return }
    startTransition(async () => { setResults(await searchStudents(value)) })
  }

  if (selectedStudent) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary bg-surface px-3 py-2.5 ring-4 ring-school-soft">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-school-soft text-xs font-semibold text-school-ink">
          {selectedStudent.first_name[0]}{selectedStudent.last_name[0]}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{selectedStudent.first_name} {selectedStudent.last_name}</span>
          <span className="text-xs text-text-secondary">{selectedStudent.admission_no}</span>
        </span>
        <button type="button" onClick={() => router.push('/dashboard/fees/record')} className="flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-text-secondary hover:bg-raised hover:text-text-primary">
          <Icon icon={Cancel01Icon} size={16} /> Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <label className="flex h-12 items-center gap-2.5 rounded-xl border border-control bg-surface px-3.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-school-soft">
        <Icon icon={Search01Icon} size={18} className="text-text-secondary" />
        <span className="sr-only">Find a student</span>
        <input
          autoFocus
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Student name or admission number"
          className="min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none"
        />
        {isPending && <span className="text-xs text-text-secondary">Searching…</span>}
      </label>
      {results.length > 0 && (
        <ul className="card absolute inset-x-0 top-[calc(100%+6px)] z-10 max-h-72 overflow-auto p-1.5 shadow-raise">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => { router.push(`/dashboard/fees/record?studentId=${s.id}`); setResults([]); setQuery('') }}
                className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-school-soft active:bg-school-soft"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-semibold">{s.first_name[0]}{s.last_name[0]}</span>
                <span className="flex-1 font-medium">{s.first_name} {s.last_name}</span>
                <span className="text-xs text-text-secondary">{s.admission_no}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && !isPending && results.length === 0 && (
        <p className="mt-2 text-sm text-text-secondary">No student matches “{query}”.</p>
      )}
    </div>
  )
}
