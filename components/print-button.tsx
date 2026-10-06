'use client'

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors"
    >
      {label}
    </button>
  )
}
