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
    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-surface-muted/60 border border-border rounded-xl">
      {children.map((c) => {
        const isSelected = c.id === selectedStudentId
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => handleChange(c.id)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isSelected
                ? 'bg-surface shadow-xs text-text-primary border border-border'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/50 border border-transparent'
            }`}
          >
            {c.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.photo_url}
                alt={c.first_name}
                className="w-5 h-5 rounded-full object-cover shrink-0 border border-border"
              />
            ) : (
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold shrink-0">
                {c.first_name[0]}{c.last_name[0]}
              </span>
            )}
            <span>{c.first_name} {c.last_name}</span>
          </button>
        )
      })}
    </div>
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
      className="rounded-lg border border-border px-3 py-1.5 text-sm bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {terms.map((t) => (
        <option key={t.id} value={t.id}>
          {t.academic_sessions?.name ? `${t.academic_sessions.name} · ` : ''}{t.name}
        </option>
      ))}
    </select>
  )
}