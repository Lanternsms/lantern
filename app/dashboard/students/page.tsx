import { createClient } from '@/lib/supabase/server'

const avatarColors = ['bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-orange-100 text-orange-700', 'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700']

function avatarColor(name: string) {
  const index = name.charCodeAt(0) % avatarColors.length
  return avatarColors[index]
}

export default async function StudentsPage() {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('is_current', true)
    .single()

  if (!session) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-text-secondary">No current academic session set.</p>
      </div>
    )
  }

  const { data: students, error } = await supabase
    .from('students')
    .select(`
      id, admission_no, first_name, last_name, status,
      enrolments!inner ( classes ( name ), arms ( name ) )
    `)
    .eq('enrolments.session_id', session.id)
    .order('last_name')

  return (
    <div className="px-8 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Students</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage and view student records across your school.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
            Import
          </button>
          <button className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
            Export
          </button>
          <button className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
            + Add Student
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-danger-text">Error: {error.message}</p>}

      {!error && students?.length === 0 && (
        <p className="text-sm text-text-secondary">
          No students found in your assigned classes for the current session.
        </p>
      )}

      {students && students.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Student</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Admission No.</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Class</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Arm</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const enrolment = s.enrolments?.[0]
                const initials = `${s.first_name[0]}${s.last_name[0]}`
                const isActive = s.status === 'active'
                return (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${avatarColor(s.first_name)}`}>
                          {initials}
                        </span>
                        <span className="text-text-primary font-medium">{s.first_name} {s.last_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{s.admission_no}</td>
                    <td className="px-4 py-3 text-text-secondary">{enrolment?.classes?.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{enrolment?.arms?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${isActive ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'}`}>
                        {isActive ? 'Active' : s.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}