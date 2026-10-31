import { BulkImportWizard } from '@/components/bulk-import-wizard'
import Link from 'next/link'

export default function BulkImportPage() {
  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8 max-w-3xl">
      <Link href="/dashboard/students" className="inline-flex w-fit items-center gap-1 text-sm text-text-secondary hover:text-text-primary">← Back to students
      </Link>
      <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px] mt-4 mb-1">Import Students</h1>
      <p className="text-sm text-text-secondary mb-6">
        Upload a CSV file to add multiple students at once.
      </p>

      <BulkImportWizard />
    </div>
  )
}