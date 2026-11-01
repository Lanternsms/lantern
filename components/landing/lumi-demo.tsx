'use client'

import { useState } from 'react'

const ANSWERS = {
  ask: 'Make the bottom numbers the same first.\n3 and 4 both go into 12, so 1/3 = 4/12 and 1/4 = 3/12.\nNow add the tops: 4 + 3 = 7. The answer is 7/12.',
  simpler: 'Cut a pizza into 12 slices. A third is 4 slices, a quarter is 3 slices.\nTogether that’s 7 of the 12 slices: 7/12.',
  quiz: 'Your turn: what is 2/3 + 1/6?\nHint from Mr. Bello’s notes: 6 is already a multiple of 3.',
} as const

type Intent = keyof typeof ANSWERS

const CHIPS: { key: Intent; label: string }[] = [
  { key: 'ask', label: 'Ask' },
  { key: 'simpler', label: 'Explain it simpler' },
  { key: 'quiz', label: 'Quiz me' },
]

export function LumiDemo() {
  const [intent, setIntent] = useState<Intent>('ask')
  return (
    <div className="flex flex-wrap items-center gap-14">
      <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
        <h2 className="text-[clamp(32px,3.8vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-[#182350]">
          Lessons that answer back.
        </h2>
        <p className="max-w-[42ch] text-[#4a505b]">
          Teachers record a lesson once and attach their notes. Students watch at home and ask LUMI when they’re stuck.
          LUMI answers only from that teacher’s notes, and the teacher sees which questions keep coming up.
        </p>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => {
            const on = c.key === intent
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => setIntent(c.key)}
                className={`h-[38px] rounded-full border px-3.5 text-sm font-medium ${
                  on ? 'border-[#182350] bg-[#182350] text-white' : 'border-[#d5d9e3] bg-white text-[#182350] hover:border-[#182350]'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>
      <div data-ui className="flex min-w-0 flex-[1_1_480px] flex-col gap-3.5 rounded-2xl border border-[#e2e5ee] bg-white p-5 shadow-[0_1px_2px_rgba(24,35,80,0.04),0_12px_32px_-12px_rgba(24,35,80,0.12)]">
        <span className="text-[13px] text-[#6b7280]">LUMI · from Mr. Bello’s notes on “Adding unlike fractions”</span>
        <span className="self-end rounded-[14px_14px_4px_14px] bg-[#182350] px-3.5 py-2.5 text-[15px] font-medium text-white">
          How do I add 1/3 and 1/4?
        </span>
        <span
          key={intent}
          aria-live="polite"
          className="max-w-[92%] self-start whitespace-pre-line rounded-[14px_14px_14px_4px] bg-[#f1f3f8] px-4 py-3.5 text-[15px] leading-relaxed text-[#1f2430] [animation:fade-blur_220ms_var(--ease-out)]"
        >
          {ANSWERS[intent]}
        </span>
      </div>
    </div>
  )
}
