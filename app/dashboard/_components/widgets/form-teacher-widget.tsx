import Link from 'next/link'

export async function FormTeacherWidget() {
  return (
    <div className="border border-border rounded-xl p-5 bg-surface h-full">
      <h2 className="text-sm font-semibold text-text-primary mb-2">Your Class</h2>
      <p className="text-sm text-text-secondary mb-3">You're the form teacher for one of the classes.</p>
      <Link href="/dashboard/my-class" className="text-xs font-medium text-primary hover:underline">Go to My Class →</Link>
    </div>
  )
}