import Link from 'next/link'

const LINKS = [
  { label: 'My Results', href: '/dashboard/my-results' },
  { label: 'My Timetable', href: '/dashboard/my-timetable' },
  { label: 'My Payments', href: '/dashboard/payments' },
]

export async function StudentWidget() {
  return (
    <div className="border border-border rounded-xl p-5 bg-surface h-full">
      <h2 className="text-sm font-semibold text-text-primary mb-3">Your School Life</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-text-primary border border-border rounded-lg px-3 py-2 hover:border-text-secondary transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}