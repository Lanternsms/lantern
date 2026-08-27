'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import Link from 'next/link'
import { bulkImportStudents, type BulkImportRow, type BulkImportResult } from '@/app/dashboard/students/actions'
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react'

const TARGET_FIELDS: { key: keyof BulkImportRow; label: string; required: boolean }[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'admission_no', label: 'Admission Number', required: true },
  { key: 'class_name', label: 'Class', required: true },
  { key: 'arm_name', label: 'Arm', required: false },
  { key: 'date_of_birth', label: 'Date of Birth', required: false },
  { key: 'gender', label: 'Gender', required: false },
]

type Step = 'upload' | 'map' | 'preview' | 'done'

export function BulkImportWizard() {
  const [step, setStep] = useState<Step>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  function handleFile(file: File) {
    setParseError(null)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setParseError('This file has no data rows.')
          return
        }
        const detectedHeaders = results.meta.fields ?? []
        setHeaders(detectedHeaders)
        setCsvRows(results.data)

        // Best-effort auto-mapping: match a CSV header to a target field
        // if the header text loosely contains the field's label — saves
        // the user from manually mapping obvious matches like "First Name".
        const autoMapping: Record<string, string> = {}
        for (const field of TARGET_FIELDS) {
          const match = detectedHeaders.find((h) =>
            h.toLowerCase().replace(/[^a-z]/g, '').includes(field.key.replace(/_/g, ''))
          )
          if (match) autoMapping[field.key] = match
        }
        setMapping(autoMapping)
        setStep('map')
      },
      error: (err) => setParseError(err.message),
    })
  }

  const mappedRows: BulkImportRow[] = csvRows.map((row) => ({
    first_name: row[mapping.first_name] ?? '',
    last_name: row[mapping.last_name] ?? '',
    admission_no: row[mapping.admission_no] ?? '',
    class_name: row[mapping.class_name] ?? '',
    arm_name: row[mapping.arm_name] ?? '',
    date_of_birth: row[mapping.date_of_birth] ?? '',
    gender: row[mapping.gender] ?? '',
  }))

  const requiredFieldsMapped = TARGET_FIELDS.filter((f) => f.required).every((f) => mapping[f.key])

  async function handleConfirm() {
    setImporting(true)
    const res = await bulkImportStudents(mappedRows)
    setResult(res)
    setImporting(false)
    setStep('done')
  }

  function downloadTemplate() {
    const csv = 'First Name,Last Name,Admission Number,Class,Arm,Date of Birth,Gender\n' +
      'Chidinma,Okonkwo,GSS/2025/0142,JSS1,A,2012-04-15,female\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lantern_student_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---------------- STEP 1: UPLOAD ----------------
  if (step === 'upload') {
    return (
      <div className="bg-surface border border-border rounded-xl p-8">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          className="border border-dashed border-border rounded-xl py-12 flex flex-col items-center gap-3 text-center"
        >
          <Upload size={24} className="text-text-muted" />
          <p className="text-sm text-text-secondary">Drag and drop a CSV file, or click to browse</p>
          <label className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 cursor-pointer transition-colors">
            Choose File
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </div>

        {parseError && (
          <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mt-4">
            {parseError}
          </p>
        )}

        <button onClick={downloadTemplate} className="text-sm text-primary hover:text-primary-hover mt-4">
          Download a template CSV
        </button>
      </div>
    )
  }

  // ---------------- STEP 2: COLUMN MAPPING ----------------
  if (step === 'map') {
    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-1">Map Your Columns</h2>
        <p className="text-sm text-text-secondary mb-5">
          Match each field Lantern needs to a column from your file. {csvRows.length} rows detected.
        </p>

        <div className="space-y-3">
          {TARGET_FIELDS.map((field) => (
            <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
              <label className="text-sm text-text-primary">
                {field.label} {field.required && <span className="text-danger-text">*</span>}
              </label>
              <select
                value={mapping[field.key] ?? ''}
                onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— Skip —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex justify-between mt-6">
          <button onClick={() => setStep('upload')} className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
            Back
          </button>
          <button
            onClick={() => setStep('preview')}
            disabled={!requiredFieldsMapped}
            className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue to Preview
          </button>
        </div>
      </div>
    )
  }

  // ---------------- STEP 3: PREVIEW ----------------
  if (step === 'preview') {
    const previewRows = mappedRows.slice(0, 10)
    const rowsMissingRequired = mappedRows.filter(
      (r) => !r.first_name.trim() || !r.last_name.trim() || !r.admission_no.trim() || !r.class_name.trim()
    ).length

    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-1">Preview Import</h2>
        <p className="text-sm text-text-secondary mb-4">
          Showing {previewRows.length} of {mappedRows.length} rows. Class/arm names are matched at import time —
          any that don&apos;t match your school&apos;s existing classes will be skipped and reported.
        </p>

        {rowsMissingRequired > 0 && (
          <div className="flex items-center gap-2 text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={16} />
            {rowsMissingRequired} row(s) are missing a required field and will be skipped.
          </div>
        )}

        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                {TARGET_FIELDS.map((f) => (
                  <th key={f.key} className="text-left font-medium text-text-secondary px-3 py-2 text-xs uppercase tracking-wide whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => {
                const isInvalid = !row.first_name.trim() || !row.last_name.trim() || !row.admission_no.trim() || !row.class_name.trim()
                return (
                  <tr key={i} className={`border-b border-border last:border-0 ${isInvalid ? 'bg-danger-bg/40' : ''}`}>
                    {TARGET_FIELDS.map((f) => (
                      <td key={f.key} className="px-3 py-2 text-text-primary whitespace-nowrap">
                        {row[f.key] || <span className="text-text-muted">—</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between mt-6">
          <button onClick={() => setStep('map')} className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={importing}
            className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors disabled:opacity-60"
          >
            {importing ? 'Importing…' : `Import ${mappedRows.length} Students`}
          </button>
        </div>
      </div>
    )
  }

  // ---------------- STEP 4: RESULT ----------------
  return (
    <div className="bg-surface border border-border rounded-xl p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 size={28} className="text-success-text" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-1">Import Complete</h2>
      <p className="text-sm text-text-secondary mb-6">
        {result?.successCount} student(s) imported successfully.
        {result && result.errors.length > 0 && ` ${result.errors.length} row(s) had errors.`}
      </p>

      {result && result.errors.length > 0 && (
        <div className="text-left max-w-md mx-auto mb-6 max-h-48 overflow-y-auto border border-border rounded-lg">
          {result.errors.map((e, i) => (
            <div key={i} className="text-sm px-3 py-2 border-b border-border last:border-0">
              <span className="font-medium text-text-primary">Row {e.row}:</span>{' '}
              <span className="text-text-secondary">{e.message}</span>
            </div>
          ))}
        </div>
      )}

      <Link href="/dashboard/students" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
        Go to Students
      </Link>
    </div>
  )
}