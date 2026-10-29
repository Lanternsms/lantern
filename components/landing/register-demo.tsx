'use client'

import { useState } from 'react'

const STUDENTS = [
  { name: 'Abdullahi Sani', parent: 'Mr. Sani' },
  { name: 'Blessing Udo', parent: 'Mrs. Udo' },
  { name: 'Chinedu Okeke', parent: 'Mrs. Okeke' },
  { name: 'Damilola Ajayi', parent: 'Mr. Ajayi' },
  { name: 'Esther Danjuma', parent: 'Mrs. Danjuma' },
  { name: 'Femi Lawal', parent: 'Mr. Lawal' },
]

/**
 * The landing page's one live thing: mark a student absent and watch the parent's phone.
 * Uses the product's real behaviour (a guardian is told the minute the register is saved).
 */
export function RegisterDemo() {
  const [absent, setAbsent] = useState<Record<number, boolean>>({ 4: true })
  const [last, setLast] = useState(4)

  const out = STUDENTS.map((_, i) => i).filter((i) => absent[i])
  const shown = absent[last] ? last : out[out.length - 1]
  const s = shown === undefined ? null : STUDENTS[shown]

  return (
    <div aria-label="Try it: mark a student absent" className="relative flex w-full flex-col items-end gap-4 sm:block sm:min-h-[470px]">
      <div className="w-full overflow-hidden rounded-2xl border border-[#e7e7e7] bg-white sm:w-[63%] sm:min-w-[330px]">
        <div className="flex items-center justify-between border-b border-[#efefef] px-4 py-3.5">
          <span className="text-[15px] font-semibold">JSS 2B · register</span>
          <span className="text-[13px] text-[#5c626c] tabular-nums">
            {STUDENTS.length - out.length} of {STUDENTS.length} present
          </span>
        </div>
        <ul>
          {STUDENTS.map((st, i) => {
            const isOut = !!absent[i]
            return (
              <li key={st.name} className="flex items-center gap-3 border-b border-[#f4f4f4] px-4 py-2">
                <span className="flex-1 text-[15px]">{st.name}</span>
                <button
                  type="button"
                  aria-pressed={isOut}
                  aria-label={`${st.name}: ${isOut ? 'absent' : 'present'}. Tap to change.`}
                  onClick={() => {
                    setAbsent((a) => ({ ...a, [i]: !a[i] }))
                    setLast(i)
                  }}
                  className={`h-[34px] min-w-[92px] rounded-lg border text-sm font-semibold ${
                    isOut
                      ? 'border-[#fecaca] bg-[#ffedea] text-[#831c1e]'
                      : 'border-[#dbe3fd] bg-[#eef2ff] text-[#1e3a8a]'
                  }`}
                >
                  {isOut ? 'Absent' : 'Present'}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="px-4 py-2.5 text-[13px] text-[#5c626c]">Tap a student to mark them absent</p>
      </div>

      <div className="h-[300px] w-[230px] rounded-[34px] bg-[#0c0f14] p-2.5 sm:absolute sm:bottom-0 sm:right-0">
        <div className="flex h-full flex-col gap-2.5 overflow-hidden rounded-[26px] bg-[#eef0f3] px-3 py-4">
          <span className="text-center text-[13px] text-[#5c626c]">{s ? `${s.parent}’s phone` : 'A parent’s phone'}</span>
          {s ? (
            <div
              key={s.name}
              aria-live="polite"
              className="flex flex-col gap-1 rounded-2xl bg-white p-3 [animation:notify_320ms_var(--ease-out)]"
            >
              <span className="flex items-center gap-1.5 text-xs text-[#5c626c]">
                <span className="h-4 w-4 rounded bg-[#1d4ed8]" />
                Greenfield College · now
              </span>
              <span className="text-sm font-semibold leading-snug">{s.name.split(' ')[0]} is absent today</span>
              <span className="text-[13px] leading-snug text-[#3d434d]">
                Marked by Mr. Bello in JSS 2B at 8:04am. Tap to tell the school why.
              </span>
            </div>
          ) : (
            <span aria-live="polite" className="mt-16 px-3 text-center text-sm text-[#5c626c]">
              No message — everyone in JSS 2B is at school.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
