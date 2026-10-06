'use client'

import { useState } from 'react'

const PRESETS = {
  outstanding: {
    category: 'Outstanding (80%+)',
    remarks: [
      'An outstanding performance! Consistently exhibits excellence and focus.',
      'Brilliant results across all subjects. A role model in class.',
      'Exceptional diligence and academic excellence. Keep it up!',
      'Magnificent achievement this term. Highly commendable work.',
    ],
  },
  good: {
    category: 'Commendable / Good (60–79%)',
    remarks: [
      'A commendable result with steady progress. Keep aiming higher.',
      'Good performance. With more attention in difficult areas, can reach the top.',
      'Satisfactory work done this term. Shows strong potential.',
      'A very good effort. Consistently participates and completes tasks.',
    ],
  },
  average: {
    category: 'Fair / Average (40–59%)',
    remarks: [
      'A fair result. Needs to put in more consistent study time.',
      'Has potential to perform better. More concentration required in class.',
      'Average performance. Encouraged to seek help in challenging subjects.',
      'Capable of much better results with greater dedication.',
    ],
  },
  improvement: {
    category: 'Needs Improvement (<40%)',
    remarks: [
      'Performance is below expectations. Close supervision and remedial study needed.',
      'Must show greater commitment and discipline in schoolwork next term.',
      'Serious effort required. Urgently advise parent-teacher consultation.',
      'Struggling in core subjects. Needs active guidance at home and school.',
    ],
  },
}

export function RemarkPresetPicker({
  targetInputId,
  disabled = false,
}: {
  targetInputId: string
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (disabled) return null

  function applyRemark(text: string) {
    const el = document.getElementById(targetInputId) as HTMLTextAreaElement | null
    if (el) {
      el.value = text
      // Dispatch change event so React / form state recognizes it
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    setIsOpen(false)
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-[11px] font-medium text-primary hover:text-primary-hover bg-primary/10 hover:bg-primary/15 rounded px-2 py-0.5 transition-colors"
      >
        ✨ Presets
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-80 max-h-72 overflow-y-auto bg-surface border border-border rounded-xl shadow-xl z-30 p-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border">
              <span className="font-semibold text-text-primary">Quick Remarks</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            {Object.entries(PRESETS).map(([key, group]) => (
              <div key={key} className="mb-2.5 last:mb-0">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-1 mb-1">
                  {group.category}
                </p>
                <div className="space-y-1">
                  {group.remarks.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyRemark(r)}
                      className="w-full text-left p-1.5 rounded hover:bg-surface-muted text-text-secondary hover:text-text-primary transition-colors text-xs leading-snug"
                    >
                      &ldquo;{r}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
