import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ClassesPage() {
  const supabase = await createClient()

  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, name, level, departments(name), arms(id)')
    .order('level', { ascending: true, nullsFirst: false })

  return (
    <div className="px-8 py-8">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics" className="hover:text-primary">Academics</Link> / Classes &amp; Arms
      </p>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Classes</h1>
          <p className="text-sm text-text-secondary mt-1">Manage your school&apos;s classes and their arms.</p>
        </div>
        <Link href="/dashboard/academics/classes/new" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
          + Add Class
        </Link>
      </div>

      {error && <p className="text-sm text-danger-text">Error: {error.message}</p>}
      {!error && classes?.length === 0 && <p className="text-sm text-text-secondary">No classes added yet.</p>}

      {classes && classes.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/academics/classes/${c.id}`}
              className="bg-surface border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
            >
              <h3 className="text-sm font-semibold text-text-primary mb-1">{c.name}</h3>
              <p className="text-xs text-text-secondary">{c.departments?.name ?? 'No department'}</p>
              <p className="text-xs text-text-muted mt-2">
                {c.arms?.length ?? 0} arm{c.arms?.length === 1 ? '' : 's'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}