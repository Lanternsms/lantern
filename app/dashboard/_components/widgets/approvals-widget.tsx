import Link from 'next/link'

export async function ApprovalsWidget() {
  return (
    <div className="border border-border rounded-xl p-5 bg-surface h-full">
      <h2 className="text-sm font-semibold text-text-primary mb-2">Approvals</h2>
      <p className="text-sm text-text-secondary mb-3">Review items waiting on your sign-off.</p>
      <Link href="/dashboard/approvals" className="text-xs font-medium text-primary hover:underline">Go to Approvals →</Link>
    </div>
  )
}