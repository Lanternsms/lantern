'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'
import { Icon } from '@/components/icon'
import { recordPayment } from '../actions'

type FeeItem = { id: string; name: string; amount: number }

const METHODS = [
  { value: 'bank_transfer', label: 'Transfer' },
  { value: 'pos', label: 'POS' },
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online' },
]
const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`

/** One fee item is paid in full per payment; the panel makes that rule the shape of the form. */
export default function PaymentPanel({
  dueItems, paidFeeStructureIds, studentId,
}: {
  studentId: string
  dueItems: FeeItem[]
  paidFeeStructureIds: string[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const paidSet = new Set(paidFeeStructureIds)
  const unpaid = dueItems.filter((f) => !paidSet.has(f.id))
  const [payingId, setPayingId] = useState<string | null>(unpaid[0]?.id ?? null)
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')

  const owing = unpaid.reduce((s, f) => s + Number(f.amount), 0)
  const chosen = unpaid.find((f) => f.id === payingId)
  const after = owing - Number(chosen?.amount ?? 0)

  function pay() {
    if (!payingId) return
    setError('')
    startTransition(async () => {
      const result = await recordPayment({ studentId, feeStructureId: payingId, paymentMethod: method, reference })
      if (result.error) setError(result.error)
      else router.push(`/dashboard/fees/receipt/${result.paymentId}`)
    })
  }

  if (dueItems.length === 0) {
    return <p className="rounded-xl bg-raised px-4 py-3 text-sm text-text-secondary">No fee items are set up for this student’s class this term. Add them under Fee structures.</p>
  }
  if (unpaid.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm font-medium text-success-text">
        <Icon icon={CheckmarkCircle02Icon} size={18} /> Everything for this term is paid.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">What it pays for</legend>
        {unpaid.map((f) => {
          const on = f.id === payingId
          return (
            <label key={f.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 transition-colors ${on ? 'border-primary bg-school-soft/60' : 'border-border hover:border-control'}`}>
              <input type="radio" name="fee" checked={on} onChange={() => setPayingId(f.id)} className="h-4 w-4 accent-[var(--color-primary)]" />
              <span className="flex-1 font-medium">{f.name}</span>
              <span className="tabular-nums text-[#374151]">{naira(Number(f.amount))}</span>
            </label>
          )
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">How they paid</legend>
        <div role="radiogroup" aria-label="Payment method" className="flex w-fit flex-wrap gap-1 rounded-xl bg-raised p-1">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={method === m.value}
              onClick={() => setMethod(m.value)}
              className={`h-9 rounded-lg px-4 text-sm font-medium ${method === m.value ? 'bg-surface text-text-primary shadow-card' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Reference
        <span className="font-normal text-text-secondary">Bank, POS or teller reference, so the receipt can be matched later</span>
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. FBN/TRF/48213907" className="h-11 rounded-xl border border-control bg-surface px-3.5 text-[15px] font-normal focus:border-primary focus:outline-none focus:ring-4 focus:ring-school-soft" />
      </label>

      {error && <p role="alert" className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5">
        <span className="text-sm text-text-secondary">Balance after this payment: <strong className="font-semibold tabular-nums text-text-primary">{naira(after)}</strong></span>
        <button type="button" onClick={pay} disabled={isPending || !chosen} className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
          {isPending ? 'Recording…' : `Record ${chosen ? naira(Number(chosen.amount)) : ''} and send receipt`}
        </button>
      </div>
    </div>
  )
}
