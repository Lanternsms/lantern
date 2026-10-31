import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ClassesPage() {
  const supabase = await createClient()

  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, name, level, departments(name), arms(id)')
    .order('level', { ascending: true, nullsFirst: false })

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics" className="hover:text-primary">Academics</Link> / Classes &amp; Arms
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">Classes</h1>
          <p className="mt-1 text-[15px] text-text-secondary">Manage your school&apos;s classes and their arms.</p>
        </div>
        <Link href="/dashboard/academics/classes/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">Add Class
        </Link>
      </div>

      {error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">Couldn’t load this: {error.message}</p>}
      {!error && classes?.length === 0 && <p className="text-sm text-text-secondary">No classes added yet.</p>}

      {classes && classes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/academics/classes/${c.id}`}
              className="bg-surface border border-border rounded-lg p-5 hover:border-primary/40 transition-colors"
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