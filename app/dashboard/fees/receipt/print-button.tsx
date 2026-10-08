'use client'
export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="w-full bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium">
      Print Receipt
    </button>
  )
}