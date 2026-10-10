import Link from 'next/link'

export async function AcademicStructureWidget() {
  return (
    <div className="border border-border rounded-xl p-5 bg-surface h-full">
      <h2 className="text-sm font-semibold text-text-primary mb-2">Academic Structure</h2>
      <p className="text-sm text-text-secondary mb-3">Manage classes, arms, and grading.</p>
      <Link href="/dashboard/academics" className="text-xs font-medium text-primary hover:underline">Go to Academics →</Link>
    </div>
  )
}