'use client'

export function TeacherSelect({
  name,
  defaultValue,
  teachers,
  autoSubmit = false,
}: {
  name: string
  defaultValue?: string
  teachers: { id: string; first_name: string; last_name: string }[]
  autoSubmit?: boolean
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ''}
      onChange={autoSubmit ? (e) => e.currentTarget.form?.requestSubmit() : undefined}
      className="text-xs rounded-lg border border-border px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <option value="">{autoSubmit ? 'No teacher assigned' : 'No teacher yet'}</option>
      {teachers.map((t) => (
        <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
      ))}
    </select>
  )
}