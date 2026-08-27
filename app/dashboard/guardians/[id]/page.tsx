import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { User, Users, FileText, Pencil } from 'lucide-react'

export default async function GuardianDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: guardian, error } = await supabase
    .from('guardians')
    .select('id, first_name, last_name, relationship, phone, email, address')
    .eq('id', id)
    .single()

  if (error || !guardian) notFound()

  const { data: links } = await supabase
    .from('student_guardians')
    .select('is_primary_contact, students(id, first_name, last_name, admission_no, status)')
    .eq('guardian_id', id)

  const { data: fieldDefs } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label')
    .eq('entity_type', 'guardian')
    .order('sort_order')

  const { data: fieldValues } = await supabase
    .from('custom_field_values')
    .select('definition_id, value')
    .eq('entity_id', id)

  const valueByDefId = new Map((fieldValues ?? []).map((v) => [v.definition_id, v.value]))

  const initials = `${guardian.first_name[0]}${guardian.last_name[0]}`

  return (
    <div className="px-8 py-8 max-w-2xl">
      <Link href="/dashboard/guardians" className="text-sm text-primary hover:text-primary-hover">
        ← Back to guardians
      </Link>

      <div className="flex items-center justify-between mt-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
            {initials}
          </span>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">{guardian.first_name} {guardian.last_name}</h1>
            <p className="text-xs text-text-secondary mt-0.5 capitalize">{guardian.relationship ?? 'Guardian'}</p>
          </div>
        </div>
        <Link
          href={`/dashboard/guardians/${id}/edit`}
          className="flex items-center gap-1.5 text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors"
        >
          <Pencil size={14} /> Edit Guardian
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
              <p className={guardian.phone ? 'text-text-primary' : 'text-text-muted'}>{guardian.phone ?? 'Not provided'}</p>
            </div>
            <div>
              <p className="text-text-secondary text-xs mb-0.5">Email Address</p>
              <p className={guardian.email ? 'text-text-primary' : 'text-text-muted'}>{guardian.email ?? 'Not provided'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-text-secondary text-xs mb-0.5">Address</p>
              <p className={guardian.address ? 'text-text-primary' : 'text-text-muted'}>{guardian.address ?? 'Not provided'}</p>
            </div>
          </div>
        </section>

        {fieldDefs && fieldDefs.length > 0 && (
          <section className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={16} className="text-text-secondary" />
              <h3 className="text-sm font-medium text-text-primary">Custom Fields</h3>
            </div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              {fieldDefs.map((def) => {
                const value = valueByDefId.get(def.id) as string | boolean | undefined
                const displayValue =
                  typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (value as string) ?? null
                return (
                  <div key={def.id}>
                    <p className="text-text-secondary text-xs mb-0.5">{def.label}</p>
                    <p className={displayValue ? 'text-text-primary' : 'text-text-muted'}>
                      {displayValue ?? 'Not provided'}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-text-secondary" />
            <h3 className="text-sm font-medium text-text-primary">Linked Students</h3>
          </div>
          {links && links.length > 0 ? (
            <div className="space-y-1">
              {links.map((link, i) => (
                <Link
                  key={i}
                  href={`/dashboard/students/${link.students?.id}?from=guardian&guardianId=${id}`}
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-surface-muted transition-colors"
                >
                  <div>
                    <p className="text-sm text-text-primary">{link.students?.first_name} {link.students?.last_name}</p>
                    <p className="text-xs text-text-secondary">{link.students?.admission_no}</p>
                  </div>
                  {link.is_primary_contact && (
                    <span className="text-xs bg-success-bg text-success-text rounded-full px-2 py-0.5">Primary contact</span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Not linked to any students yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}