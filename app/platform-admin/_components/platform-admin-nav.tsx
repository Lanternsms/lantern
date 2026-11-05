import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

const TABS = [
  { href: '/platform-admin/demos', label: 'Demo requests', key: 'demos' },
  { href: '/platform-admin/onboard', label: 'Onboard School', key: 'onboard' },
  { href: '/platform-admin/billing', label: 'Billing', key: 'billing' },
  { href: '/platform-admin/audit-log', label: 'Audit Log', key: 'audit-log' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** New demo requests nobody has acted on yet; shown as a count on the tab. */
async function newDemoCount() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (createAdminClient() as any).from('demo_requests').select('id', { count: 'exact', head: true }).eq('status', 'new')
    return count ?? 0
  } catch {
    return 0
  }
}

export async function PlatformAdminNav({ active }: { active: TabKey }) {
  const fresh = await newDemoCount()
  return (
    <nav className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab.key === active ? 'border-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab.label}
          {tab.key === 'demos' && fresh > 0 && (
            <span className="min-w-5 rounded-full bg-danger-text px-1.5 text-center text-[11px] font-semibold leading-5 text-white tabular-nums">{fresh}</span>
          )}
        </Link>
      ))}
    </nav>
  )
}
