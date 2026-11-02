import Link from 'next/link'

const TABS = [
  { href: '/platform-admin/onboard', label: 'Onboard School', key: 'onboard' },
  { href: '/platform-admin/billing', label: 'Billing', key: 'billing' },
  { href: '/platform-admin/audit-log', label: 'Audit Log', key: 'audit-log' },
] as const

export function PlatformAdminNav({ active }: { active: 'onboard' | 'billing' | 'audit-log' }) {
  return (
    <nav className="flex items-center gap-1 border-b border-border mb-6">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab.key === active
              ? 'border-control text-text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}