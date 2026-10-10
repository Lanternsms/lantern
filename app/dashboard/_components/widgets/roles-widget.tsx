import Link from 'next/link'

export async function RolesWidget() {
  return (
    <div className="border border-border rounded-xl p-5 bg-surface h-full">
      <h2 className="text-sm font-semibold text-text-primary mb-2">Roles & Permissions</h2>
      <p className="text-sm text-text-secondary mb-3">Define what each role can access.</p>
      <Link href="/dashboard/roles" className="text-xs font-medium text-primary hover:underline">Manage Roles →</Link>
    </div>
  )
}