'use client'

export function SelectAutosubmit({
  name,
  defaultValue,
  options,
  className,
}: {
  name: string
  defaultValue?: string
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={className ?? 'rounded-lg border border-border px-3 py-2 text-sm'}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
