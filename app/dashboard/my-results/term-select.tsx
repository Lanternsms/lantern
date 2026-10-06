'use client'

export function TermSelect({
  terms,
  selectedTermId,
}: {
  terms: { id: string; name: string; academic_sessions: { name: string } | null }[]
  selectedTermId: string
}) {
  return (
    <form method="get" className="flex items-center gap-2">
      <select
        name="term"
        defaultValue={selectedTermId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-border px-3 py-1.5 text-sm"
      >
        {terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.academic_sessions?.name} &middot; {t.name}
          </option>
        ))}
      </select>
    </form>
  )
}
