// app/dashboard/attendance/settings/page.tsx
import { createClient } from '@/lib/supabase/server'
import StatusesManager from './statuses-manager'

export const dynamic = 'force-dynamic'

export default async function AttendanceSettingsPage() {
  const supabase = await createClient()
  const { data: statuses } = await supabase.from('attendance_statuses').select('*').order('code')

  return (
    <div className="p-6 space-y-4">
      <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">Attendance Categories</h1>
      <p className="text-sm text-text-secondary">
        Define the statuses teachers can mark. "Counts as present" affects future attendance-rate calculations.
      </p>
      <StatusesManager statuses={statuses ?? []} />
    </div>
  )
}