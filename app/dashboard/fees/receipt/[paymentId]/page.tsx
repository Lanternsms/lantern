import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PrintButton from '../print-button'

export const dynamic = 'force-dynamic'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', pos: 'POS', online: 'Online',
}

export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params
  const supabase = await createClient()

  const { data: payment } = await supabase
    .from('payments')
    .select('id, amount_paid, payment_method, reference, paid_at, students(first_name, last_name, admission_no), fee_structures(name)')
    .eq('id', paymentId)
    .single()

  if (!payment) notFound() // also covers "not yours to see" — payments_select RLS makes it invisible, not just unauthorized

  const { data: school } = await supabase.from('schools').select('name').single()
  const student = payment.students as any
  const feeStructure = payment.fee_structures as any

  return (
    <div className="p-6">
      <div id="receipt" className="max-w-md mx-auto bg-surface border border-border rounded-xl p-8 print:border-0 print:shadow-none">
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold text-text-primary">{school?.name ?? 'School'}</h1>
          <p className="text-xs text-text-secondary">Payment Receipt</p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-text-secondary">Receipt No.</span><span className="font-mono">{payment.id.slice(0, 8).toUpperCase()}</span></div>
          <div className="flex justify-between"><span className="text-text-secondary">Date</span><span>{new Date(payment.paid_at).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-text-secondary">Student</span><span>{student?.first_name} {student?.last_name}</span></div>
          <div className="flex justify-between"><span className="text-text-secondary">Admission No.</span><span>{student?.admission_no}</span></div>
          <div className="flex justify-between"><span className="text-text-secondary">Fee Item</span><span>{feeStructure?.name}</span></div>
          <div className="flex justify-between"><span className="text-text-secondary">Payment Method</span><span>{METHOD_LABELS[payment.payment_method ?? ''] ?? payment.payment_method}</span></div>
          {payment.reference && <div className="flex justify-between"><span className="text-text-secondary">Reference</span><span>{payment.reference}</span></div>}
        </div>

        <div className="border-t border-border mt-4 pt-4 flex justify-between text-base font-semibold text-text-primary">
          <span>Amount Paid</span>
          <span>₦{Number(payment.amount_paid).toLocaleString()}</span>
        </div>

        <p className="text-center text-xs text-text-secondary mt-8">Thank you.</p>
      </div>

      <div className="max-w-md mx-auto mt-4 print:hidden">
        <PrintButton />
      </div>
    </div>
  )
}