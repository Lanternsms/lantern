import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { User, Briefcase, BookOpen, Pencil } from 'lucide-react'
import { linkStaffProfile, unlinkStaffProfile } from './actions'
import { getLinkableProfiles } from '@/lib/staff'

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: staff, error } = await supabase
    .from('staff')
    .select('id, staff_no, first_name, last_name, email, phone, qualification, employment_date, status, profile_id, school_id, departments(name)')
    .eq('id', id)
    .single()

  if (error || !staff) notFound()

  let linkedProfile: { id: string; first_name: string; last_name: string } | null = null
  if (staff.profile_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('id', staff.profile_id)
      .single()
    linkedProfile = data
  }

  const linkableProfiles = staff.profile_id
    ? []
    : await getLinkableProfiles(supabase, staff.school_id)

  // Only meaningful if this staff member also has portal login access —
  // teaching assignments are tied to a profile_id, not the staff row itself
  const { data: assignments } = staff.profile_id
    ? await supabase
        .from('class_subjects')
        .select('classes(name), arms(name), subjects(name)')
        .eq('teacher_id', staff.profile_id)
    : { data: null }

  const initials = `${staff.first_name?.[0] ?? ''}${staff.last_name?.[0] ?? ''}`
  const isActive = staff.status === 'active'

  const portalAccessContent = (
    <div className="bg-surface border border-border rounded-xl p-5">
      <h3 className="text-sm font-medium text-text-primary mb-3">Portal Access</h3>

      {linkedProfile ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Linked to{' '}
            <span className="text-text-primary font-medium">
              {linkedProfile.first_name} {linkedProfile.last_name}
            </span>
            &apos;s login.
          </p>
          <form action={unlinkStaffProfile.bind(null, staff.id)}>
            <button
              type="submit"
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Unlink
            </button>
          </form>
        </div>
      ) : (
        <div>
          <p className="text-sm text-text-secondary mb-3">
            Not linked to a login yet. This staff member won&apos;t appear in
            teacher/assignment dropdowns until linked.
          </p>
          {linkableProfiles.length === 0 ? (
            <p className="text-xs text-text-secondary">
              No unlinked logins found. Invite one from Users &amp; Invites first,
              then come back here to link it.
            </p>
          ) : (
            <form action={linkStaffProfile.bind(null, staff.id)} className="flex gap-2">
              <select
                name="profileId"
                required
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a login to link…</option>
                {linkableProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover font-medium transition-colors"
              >
                Link
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="px-8 py-8 max-w-2xl">
      <Link href="/dashboard/staff" className="text-sm text-primary hover:text-primary-hover">
        ← Back to staff
      </Link>

      <div className="flex items-center justify-between mt-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-medium">
            {initials}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-text-primary">{staff.first_name} {staff.last_name}</h1>
              <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${isActive ? 'bg-success-bg text-success-text' : 'bg-secondary/10 text-secondary'}`}>
                {isActive ? 'Active' : staff.status}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {staff.staff_no} · {staff.departments?.name ?? 'No department'}
            </p>
          </div>
        </div>
        <Link
          href={`/dashboard/staff/${id}/edit`}
          className="flex items-center gap-1.5 text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors"
        >
          <Pencil size={14} /> Edit Staff
        </Link>
      </div>

      <div className="space-y-4">
        <section className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={16} className="text-text-secondary" />
            <h3 className="text-sm font-medium text-text-primary">Contact Information</h3>
          </div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
            <div>
              <p className="text-text-secondary text-xs mb-0.5">Phone Number</p>
              <p className={staff.phone ? 'text-text-primary' : 'text-text-muted'}>{staff.phone ?? 'Not provided'}</p>
            </div>
            <div>
              <p className="text-text-secondary text-xs mb-0.5">Email Address</p>
              <p className={staff.email ? 'text-text-primary' : 'text-text-muted'}>{staff.email ?? 'Not provided'}</p>
            </div>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={16} className="text-text-secondary" />
            <h3 className="text-sm font-medium text-text-primary">Employment Information</h3>
          </div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
            <div>
              <p className="text-text-secondary text-xs mb-0.5">Department</p>
              <p className={staff.departments?.name ? 'text-text-primary' : 'text-text-muted'}>{staff.departments?.name ?? 'Not assigned'}</p>
            </div>
            <div>
              <p className="text-text-secondary text-xs mb-0.5">Qualification</p>
              <p className={staff.qualification ? 'text-text-primary' : 'text-text-muted'}>{staff.qualification ?? 'Not provided'}</p>
            </div>
            <div>
              <p className="text-text-secondary text-xs mb-0.5">Employment Date</p>
              <p className={staff.employment_date ? 'text-text-primary' : 'text-text-muted'}>{staff.employment_date ?? 'Not provided'}</p>
            </div>
          </div>
        </section>

        {portalAccessContent}

        <section className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={16} className="text-text-secondary" />
            <h3 className="text-sm font-medium text-text-primary">Classes &amp; Subjects Taught</h3>
          </div>
          {!staff.profile_id ? (
            <p className="text-sm text-text-muted">
              This staff member doesn&apos;t have portal login access yet, so no teaching assignments can be attached.
            </p>
          ) : assignments && assignments.length > 0 ? (
            <div className="space-y-1">
              {assignments.map((a, i) => (
                <p key={i} className="text-sm text-text-primary">
                  {a.subjects?.name} — {a.classes?.name}{a.arms?.name ? ` ${a.arms.name}` : ''}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Not currently assigned to teach any classes.</p>
          )}
        </section>
      </div>
    </div>
  )
}