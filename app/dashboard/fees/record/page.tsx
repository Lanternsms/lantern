import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import StudentSearch from './student-search'
import PaymentPanel from './payment-panel'

export const dynamic = 'force-dynamic'

export default async function RecordPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>
}) {
  const { studentId } = await searchParams
  const supabase = await createClient()

  let student: any = null
  let dueItems: any[] = []
  let paidFeeStructureIds: string[] = []

  if (studentId) {
    const { data: studentRow } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_no')
      .eq('id', studentId)
      .single()
    student = studentRow

    const { data: session } = await supabase.from('academic_sessions').select('id').eq('is_current', true).single()
    const { data: term } = await supabase.from('terms').select('id').eq('is_current', true).single()

    if (session && student) {
      const { data: enrolment } = await supabase
        .from('enrolments')
        .select('class_id')
        .eq('student_id', student.id)
        .eq('session_id', session.id)
        .single()

      if (enrolment) {
        const { data: feeRows } = await supabase
          .from('fee_structures')
          .select('id, name, amount, term_id, class_id')
          .eq('session_id', session.id)
          .or(`class_id.is.null,class_id.eq.${enrolment.class_id}`)

        dueItems = (feeRows ?? []).filter((f: any) => !f.term_id || f.term_id === term?.id)

        const { data: payments } = await supabase
          .from('payments')
          .select('fee_structure_id')
          .eq('student_id', student.id)
          .in('fee_structure_id', dueItems.map((f: any) => f.id))

        paidFeeStructureIds = (payments ?? []).map((p: any) => p.fee_structure_id)
      }
    }
  }

  const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
  const paidSet = new Set(paidFeeStructureIds)
  const total = dueItems.reduce((s: number, f: any) => s + Number(f.amount), 0)
  const paidTotal = dueItems.filter((f: any) => paidSet.has(f.id)).reduce((s: number, f: any) => s + Number(f.amount), 0)

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-semibold leading-tight sm:text-[36px]">Record a payment</h1>
          <p className="text-[15px] text-text-secondary">The guardian gets the receipt as soon as you record it.</p>
        </div>
        <Link href="/dashboard/fees/structures" className="flex h-10 items-center rounded-xl bg-surface px-4 text-sm font-medium shadow-card ring-1 ring-black/[0.06] hover:bg-raised">
          Fee structures
        </Link>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Payment" className="card flex flex-col gap-6 p-5 sm:p-6">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Student</span>
            <StudentSearch selectedStudent={student} />
          </div>
          {student && <PaymentPanel studentId={student.id} dueItems={dueItems} paidFeeStructureIds={paidFeeStructureIds} />}
          {!student && <p className="text-sm text-text-secondary">Find the student first. Their unpaid items for this term will appear here.</p>}
        </section>

        {student && (
          <aside aria-label="This term" className="flex flex-col gap-4">
            <section className="flex flex-col gap-3 rounded-[24px] bg-school-deep p-6 text-white shadow-raise">
              <span className="text-sm text-school-deep-muted">Still owing this term</span>
              <span className="font-display text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{naira(total - paidTotal)}</span>
              <div className="h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-white" style={{ width: `${total ? Math.round((paidTotal / total) * 100) : 0}%` }} />
              </div>
              <span className="text-sm text-school-deep-muted">{naira(paidTotal)} of {naira(total)} paid</span>
            </section>
            {paidTotal > 0 && (
              <section className="card p-5">
                <h2 className="mb-2 text-[15px] font-semibold">Already paid</h2>
                <ul>
                  {dueItems.filter((f: any) => paidSet.has(f.id)).map((f: any) => (
                    <li key={f.id} className="flex justify-between border-b border-rule py-2.5 text-sm last:border-0">
                      <span>{f.name}</span><span className="tabular-nums text-success-text">{naira(Number(f.amount))}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
