import Link from 'next/link'
import { CheckCircle2 } from '@/components/icons'

export default async function StudentAddedSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; name?: string; class?: string; from?: string }>
}) {
  const { id, name, class: classLabel, from } = await searchParams
  const backHref = from === 'my-class' ? '/dashboard/my-class' : '/dashboard/students'
  const backLabel = from === 'my-class' ? 'Back to My Class' : 'Back to Students'

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={28} className="text-success-text" />
        </div>

        <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px] mb-1">
          Student added successfully
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          <span className="font-medium text-text-primary">{name}</span> has been added to {classLabel}.
        </p>

        <div className="flex items-center justify-center gap-3">
          {id && (
            <Link
              href={`/dashboard/students/${id}${from ? `?from=${from}` : ''}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
            >
              View Student
            </Link>
          )}
          <Link
            href={backHref}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-surface px-4 text-sm font-semibold text-text-primary shadow-card ring-1 ring-black/[0.06] hover:bg-raised"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}