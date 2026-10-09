export const dynamic = 'force-dynamic'

import Link from 'next/link'

export default function SettingsHubPage() {
  const sections = [
    { href: '/dashboard/settings/branding', title: 'Branding & Theme', description: "Logo, colors, and how your school's portal looks." },
    { href: '/dashboard/attendance/settings', title: 'Attendance Categories', description: 'Configure the attendance status options teachers can mark.' },
  ]

  return (
    <div className="px-6 py-6 max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block bg-surface border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
          >
            <h2 className="text-sm font-semibold text-text-primary">{s.title}</h2>
            <p className="text-xs text-text-secondary mt-1">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}