'use client'

export function TermSelectAutosubmit({
  terms,
  defaultValue,
}: {
  terms: { id: string; name: string; is_current: boolean }[]
  defaultValue: string
}) {
  return (
    <form method="get" className="flex items-center gap-2">
      <select
        name="term_id"
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {terms.map((t) => (
          <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' (current)' : ''}</option>
        ))}
      </select>
    </form>
  )
}
