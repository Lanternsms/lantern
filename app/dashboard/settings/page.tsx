export const dynamic = 'force-dynamic'

import { Agreement01Icon, CalendarCheckIn01Icon, ColorsIcon, Notification01Icon, Wallet01Icon } from '@hugeicons/core-free-icons'
import { HubGrid, PageHeader, PageShell } from '@/components/ui/page'

export default function SettingsHubPage() {
  return (
    <PageShell>
      <PageHeader title="School settings" subtitle="How Lantern looks and behaves for everyone at your school." />
      <HubGrid
        items={[
          { href: '/dashboard/settings/branding', title: 'Branding', description: 'Your school colour and crest, on every screen.', icon: ColorsIcon },
          { href: '/dashboard/settings/notifications', title: 'Notifications', description: 'Email and phone alerts, and whether they’re being delivered.', icon: Notification01Icon },
          { href: '/dashboard/attendance/settings', title: 'Attendance statuses', description: 'The options teachers can mark, beyond present and absent.', icon: CalendarCheckIn01Icon },
          { href: '/dashboard/settings/billing', title: 'Billing', description: 'Your Lantern subscription and invoices.', icon: Wallet01Icon },
          { href: '/dashboard/settings/audit-log', title: 'Audit log', description: 'Every change made in Lantern, who made it and when.', icon: Agreement01Icon },
        ]}
      />
    </PageShell>
  )
}
