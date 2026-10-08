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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-text-primary">Record Payment</h1>
      <StudentSearch selectedStudent={student} />
      {student && <PaymentPanel student={student} dueItems={dueItems} paidFeeStructureIds={paidFeeStructureIds} />}
    </div>
  )
}