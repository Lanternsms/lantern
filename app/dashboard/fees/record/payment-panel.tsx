'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { recordPayment } from '../actions'

type FeeItem = { id: string; name: string; amount: number }

export default function PaymentPanel({
  student, dueItems, paidFeeStructureIds,
}: {
  student: { id: string; first_name: string; last_name: string }
  dueItems: FeeItem[]
  paidFeeStructureIds: string[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [payingId, setPayingId] = useState<string | null>(null)
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')

  const paidSet = new Set(paidFeeStructureIds)
  const unpaid = dueItems.filter((f) => !paidSet.has(f.id))
  const paid = dueItems.filter((f) => paidSet.has(f.id))

  function pay(feeStructureId: string) {
    setError('')
    startTransition(async () => {
      const result = await recordPayment({ studentId: student.id, feeStructureId, paymentMethod: method, reference })
      if (result.error) setError(result.error)
      else router.push(`/dashboard/fees/receipt/${result.paymentId}`)
    })
  }

  if (dueItems.length === 0) {
    return <p className="text-sm text-text-secondary">No fee components configured for this student's class/term yet.</p>
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Outstanding</h2>
        {unpaid.length === 0 ? (
          <p className="text-sm text-text-secondary">All fee components paid for this term.</p>
        ) : (
          unpaid.map((f) => (
            <div key={f.id} className="flex items-center justify-between border-b border-border last:border-0 pb-3 last:pb-0">
              <div>
                <p className="text-sm text-text-primary">{f.name}</p>
                <p className="text-xs text-text-secondary">₦{Number(f.amount).toLocaleString()}</p>
              </div>
              <button onClick={() => setPayingId(f.id)} className="text-xs bg-primary text-white rounded-lg px-3 py-1.5">Record Payment</button>
            </div>
          ))
        )}
      </div>

      {payingId && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Confirm payment: {dueItems.find((f) => f.id === payingId)?.name} — ₦{Number(dueItems.find((f) => f.id === payingId)?.amount ?? 0).toLocaleString()}
          </h3>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Payment method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="pos">POS</option>
                <option value="online">Online</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Reference (optional)</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ref / teller no." className="border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
          </div>
          {error && <p className="text-sm text-danger-text bg-danger-bg rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => pay(payingId)} disabled={isPending} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
              {isPending ? 'Recording…' : 'Confirm & Record Payment'}
            </button>
            <button onClick={() => setPayingId(null)} className="text-sm text-text-secondary hover:underline">Cancel</button>
          </div>
        </div>
      )}

      {paid.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-2">Already Paid</h2>
          {paid.map((f) => (
            <div key={f.id} className="text-sm text-text-secondary flex justify-between py-1">
              <span>{f.name}</span><span>₦{Number(f.amount).toLocaleString()} ✓</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}