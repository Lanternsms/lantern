import Link from 'next/link'

export async function TimetableWidget() {
  return (
    <div className="border border-border rounded-xl p-5 bg-surface h-full">
      <h2 className="text-sm font-semibold text-text-primary mb-2">Timetable</h2>
      <p className="text-sm text-text-secondary mb-3">Build and adjust the school timetable.</p>
      <Link href="/dashboard/academics/timetable" className="text-xs font-medium text-primary hover:underline">Go to Timetable →</Link>
    </div>
  )
}