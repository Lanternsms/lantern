import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

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

        <h1 className="text-lg font-semibold text-text-primary mb-1">
          Student added successfully
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          <span className="font-medium text-text-primary">{name}</span> has been added to {classLabel}.
        </p>

        <div className="flex items-center justify-center gap-3">
          {id && (
            <Link
              href={`/dashboard/students/${id}${from ? `?from=${from}` : ''}`}
              className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors"
            >
              View Student
            </Link>
          )}
          <Link
            href={backHref}
            className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}