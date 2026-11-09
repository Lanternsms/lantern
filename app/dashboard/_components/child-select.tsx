'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function ChildSelect({
  children,
  selectedStudentId,
}: {
  children: { id: string; first_name: string; last_name: string; admission_no: string; photo_url?: string | null }[]
  selectedStudentId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  if (children.length <= 1) return null

  function handleChange(childId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('student', childId)
    params.set('child', childId)
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <select
      value={selectedStudentId}
      onChange={(e) => handleChange(e.target.value)}
      className="card px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {children.map((c) => (
        <option key={c.id} value={c.id}>
          {c.first_name} {c.last_name}
        </option>
      ))}
    </select>
  )
}

export function ChildrenTermSelect({
  terms,
  selectedTermId,
}: {
  terms: { id: string; name: string; academic_sessions: { name: string } | null }[]
  selectedTermId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(termId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('term', termId)
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <select
      value={selectedTermId}
      onChange={(e) => handleChange(e.target.value)}
      className="card px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {terms.map((t) => (
        <option key={t.id} value={t.id}>
          {t.academic_sessions?.name ? `${t.academic_sessions.name} · ` : ''}{t.name}
        </option>
      ))}
    </select>
  )
}