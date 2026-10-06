'use client'

export function ChildSelect({
  children,
  selectedStudentId,
}: {
  children: { id: string; first_name: string; last_name: string; admission_no: string }[]
  selectedStudentId: string
}) {
  if (children.length <= 1) return null

  return (
    <form method="get" className="flex items-center gap-2">
      <select
        name="child"
        defaultValue={selectedStudentId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-border px-3 py-1.5 text-sm"
      >
        {children.map((c) => (
          <option key={c.id} value={c.id}>
            {c.first_name} {c.last_name} &middot; {c.admission_no}
          </option>
        ))}
      </select>
    </form>
  )
}
