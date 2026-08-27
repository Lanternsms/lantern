import { BulkImportWizard } from '@/components/bulk-import-wizard'
import Link from 'next/link'

export default function BulkImportPage() {
  return (
    <div className="px-8 py-8 max-w-3xl">
      <Link href="/dashboard/students" className="text-sm text-primary hover:text-primary-hover">
        ← Back to students
      </Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-1">Import Students</h1>
      <p className="text-sm text-text-secondary mb-6">
        Upload a CSV file to add multiple students at once.
      </p>

      <BulkImportWizard />
    </div>
  )
}