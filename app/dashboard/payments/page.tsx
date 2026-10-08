import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', pos: 'POS', online: 'Online',
}

export default async function PaymentsPage() {
  const supabase = await createClient()

  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount_paid, payment_method, paid_at, students(first_name, last_name), fee_structures(name)')
    .order('paid_at', { ascending: false })

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Payment History</h1>

      {(!payments || payments.length === 0) && <p className="text-sm text-text-secondary">No payments recorded yet.</p>}

      <div className="space-y-3">
        {(payments ?? []).map((p: any) => (
          <div key={p.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">{p.fee_structures?.name}</p>
              <p className="text-xs text-text-secondary">
                {p.students?.first_name} {p.students?.last_name} · {new Date(p.paid_at).toLocaleDateString()} · {METHOD_LABELS[p.payment_method] ?? p.payment_method}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-text-primary">₦{Number(p.amount_paid).toLocaleString()}</span>
              <a href={`/dashboard/fees/receipt/${p.id}`} className="text-xs text-primary hover:underline">View Receipt</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}