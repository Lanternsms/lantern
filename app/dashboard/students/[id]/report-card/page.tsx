import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { buildReportCard } from '@/lib/report-card'
import { PrintButton } from '@/components/print-button'
import { TermSelectAutosubmit } from '@/components/term-select-autosubmit'
import Link from 'next/link'

export default async function ReportCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ term_id?: string }>
}) {
  const { id } = await params
  const { term_id } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user!.id).single()
  if (!profile) notFound()

  const { data: student } = await supabase.from('students').select('id, profile_id').eq('id', id).single()
  if (!student) notFound()

  const { data: guardianLink } = await supabase
    .from('student_guardians')
    .select('guardian_id, guardians!inner(profile_id)')
    .eq('student_id', id)
    .eq('guardians.profile_id', user!.id)
    .maybeSingle()

  const viewerIsStudentOrParent = student.profile_id === user!.id || !!guardianLink

  const { data: terms } = await supabase
    .from('terms')
    .select('id, name, is_current')
    .eq('school_id', profile.school_id)
    .order('start_date', { ascending: false })

  const selectedTermId = term_id ?? terms?.find((t) => t.is_current)?.id ?? terms?.[0]?.id

  if (!selectedTermId) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-text-secondary">No terms have been set up for your school yet.</p>
      </div>
    )
  }

  const clientForCard = viewerIsStudentOrParent ? createAdminClient() : supabase
  const card = await buildReportCard(clientForCard, profile.school_id, id, selectedTermId, viewerIsStudentOrParent)
  if (!card) notFound()

  const { data: school } = await supabase.from('schools').select('name').eq('id', profile.school_id).single()

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link
          href={viewerIsStudentOrParent ? '/dashboard/my-results' : `/dashboard/students/${id}`}
          className="text-sm text-primary hover:text-primary-hover"
        >
          ← {viewerIsStudentOrParent ? 'Back to results' : 'Back to student'}
        </Link>

        <TermSelectAutosubmit terms={terms ?? []} defaultValue={selectedTermId} />

        <PrintButton />
      </div>

      <div className="bg-surface border border-border rounded-xl p-8 print:border-0 print:shadow-none">
        <div className="text-center mb-6 pb-6 border-b border-border">
          <h1 className="text-lg font-semibold text-text-primary">{school?.name}</h1>
          <p className="text-sm text-text-secondary mt-1">Report Card — {card.term.name}, {card.session.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-y-2 text-sm mb-6">
          <div><span className="text-text-secondary">Student: </span><span className="text-text-primary font-medium">{card.student.first_name} {card.student.last_name}</span></div>
          <div><span className="text-text-secondary">Admission No: </span><span className="text-text-primary font-medium">{card.student.admission_no}</span></div>
          <div><span className="text-text-secondary">Class: </span><span className="text-text-primary font-medium">{card.classLabel}</span></div>
          {card.rankingEnabled && card.showRankToViewer && card.rank && (
            <div><span className="text-text-secondary">Position: </span><span className="text-text-primary font-medium">{card.rank} of {card.classSize}</span></div>
          )}
        </div>

        {card.subjects.length === 0 ? (
          <p className="text-sm text-text-secondary">No published results for this term yet.</p>
        ) : (
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary text-xs uppercase tracking-wide">
                <th className="py-2">Subject</th>
                {(card.assessmentNames?.length ? card.assessmentNames : Object.keys(card.subjects[0]?.scores ?? {})).map((name) => (
                  <th key={name} className="py-2">{name}</th>
                ))}
                <th className="py-2">Total</th>
                <th className="py-2">Grade</th>
                <th className="py-2">Remark</th>
              </tr>
            </thead>
            <tbody>
              {card.subjects.map((s) => (
                <tr key={s.subjectId} className="border-b border-border last:border-0">
                  <td className="py-2 text-text-primary font-medium">{s.subjectName}</td>
                  {(card.assessmentNames?.length ? card.assessmentNames : Object.keys(card.subjects[0]?.scores ?? {})).map((name) => (
                    <td key={name} className="py-2 text-text-primary">{s.scores[name] ?? '—'}</td>
                  ))}
                  <td className="py-2 text-text-primary font-medium">{s.total}</td>
                  <td className="py-2 text-text-primary">{s.grade ?? '—'}</td>
                  <td className="py-2 text-text-secondary">{s.remark ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {card.subjects.length > 0 && (
          <div className="grid grid-cols-2 gap-y-2 text-sm mb-6 pb-6 border-b border-border">
            <div><span className="text-text-secondary">Overall Total: </span><span className="text-text-primary font-medium">{card.overallTotal}</span></div>
            <div><span className="text-text-secondary">Overall Average: </span><span className="text-text-primary font-medium">{card.overallAverage}</span></div>
          </div>
        )}

        {(card.classTeacherRemark || card.principalRemark) && (
          <div className="space-y-3 text-sm">
            {card.classTeacherRemark && (
              <div><p className="text-text-secondary text-xs mb-0.5">Class Teacher&apos;s Remark</p><p className="text-text-primary">{card.classTeacherRemark}</p></div>
            )}
            {card.principalRemark && (
              <div><p className="text-text-secondary text-xs mb-0.5">Principal&apos;s Remark</p><p className="text-text-primary">{card.principalRemark}</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
