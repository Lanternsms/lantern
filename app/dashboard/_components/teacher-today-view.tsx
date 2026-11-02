import Link from 'next/link'
import type { IconSvgElement } from '@hugeicons/react'
import {
  ArrowRight01Icon, CheckmarkBadge01Icon, Comment01Icon, NoteEditIcon, RankingIcon, TimeScheduleIcon, UserCheck01Icon, UserMultipleIcon,
} from '@hugeicons/core-free-icons'
import { Icon } from '@/components/icon'

export type TeacherSlot = { id: string; time: string; end: string; subject: string; group: string; state: 'past' | 'now' | 'next' | 'later' }
export type TeacherTodayData = {
  slots: TeacherSlot[]
  formClass: string | null
  approvals: number | null
}

/**
 * A teacher's home answers one question first: what am I teaching now, and what's next?
 * The two jobs they do in class (attendance, scores) sit right under it, one tap each.
 */
export function TeacherTodayView({ slots, formClass, approvals }: TeacherTodayData) {
  const now = slots.find((s) => s.state === 'now')
  const next = slots.find((s) => s.state === 'next')
  const left = slots.filter((s) => s.state !== 'past').length

  const actions: { href: string; label: string; note: string; icon: IconSvgElement }[] = [
    { href: '/dashboard/attendance', label: 'Take attendance', note: 'Mark who is in class', icon: UserCheck01Icon },
    { href: '/dashboard/gradebook', label: 'Enter scores', note: 'CA and exam scores', icon: NoteEditIcon },
    { href: '/dashboard/my-timetable', label: 'My timetable', note: 'Your week at a glance', icon: TimeScheduleIcon },
    { href: '/dashboard/class-results', label: 'Class results', note: 'Totals and positions', icon: RankingIcon },
  ]

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="day-h" className="flex flex-col gap-5 rounded-[24px] bg-school-deep p-6 text-white shadow-raise sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 id="day-h" className="text-sm font-medium text-school-deep-muted">{now ? 'Teaching now' : next ? 'Up next' : 'Your day'}</h2>
            {now || next ? (
              <>
                <p className="font-display text-[28px] font-semibold leading-tight sm:text-[34px]">{(now ?? next)!.subject} · {(now ?? next)!.group}</p>
                <p className="text-[15px] text-school-deep-muted">
                  {now ? `Until ${now.end}` : `Starts at ${next!.time}`}
                  {left > 1 ? ` · ${left - 1} more ${left - 1 === 1 ? 'class' : 'classes'} after` : ' · last class today'}
                </p>
              </>
            ) : (
              <p className="font-display text-[24px] font-semibold leading-tight sm:text-[28px]">
                {slots.length ? 'That’s all your classes for today.' : 'No classes on your timetable today.'}
              </p>
            )}
          </div>
          {(now || next) && (
            <Link href="/dashboard/attendance" className="flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-school-deep hover:bg-school-soft">
              <Icon icon={UserCheck01Icon} size={18} /> Take attendance
            </Link>
          )}
        </div>

        {slots.length > 0 && (
          <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:overflow-visible">
            {slots.map((t) => (
              <li
                key={t.id}
                aria-current={t.state === 'now' ? 'time' : undefined}
                className={`flex min-w-[132px] flex-col gap-0.5 rounded-xl px-3 py-2.5 ${
                  t.state === 'now' ? 'bg-white text-school-deep'
                  : t.state === 'next' ? 'bg-white/20 text-white'
                  : t.state === 'past' ? 'bg-white/[0.06] text-white/55'
                  : 'border border-white/20 text-white/85'
                }`}
              >
                <span className="text-xs tabular-nums opacity-80">{t.state === 'now' ? `Now · ${t.time}` : t.time}</span>
                <span className="font-semibold leading-tight">{t.subject}</span>
                <span className="text-xs opacity-75">{t.group}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <nav aria-label="Your work" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="card group flex min-h-[112px] flex-col justify-between gap-3 p-4 transition-transform duration-100 active:scale-[0.98] sm:p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-school-soft text-school-ink">
              <Icon icon={a.icon} size={21} />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold group-hover:text-primary">{a.label}</span>
              <span className="text-[13px] text-text-secondary">{a.note}</span>
            </span>
          </Link>
        ))}
      </nav>

      {(formClass || approvals !== null) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {formClass && (
            <Link href="/dashboard/my-class" className="card flex min-h-16 items-center gap-3 px-4 py-3.5 sm:px-5">
              <span className="text-school-ink"><Icon icon={UserMultipleIcon} size={22} /></span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">Your form class · {formClass}</span>
                <span className="text-[13px] text-text-secondary">Students, attendance and report-card remarks</span>
              </span>
              <Icon icon={ArrowRight01Icon} size={18} className="text-text-secondary" />
            </Link>
          )}
          {approvals !== null && (
            <Link href="/dashboard/approvals" className="card flex min-h-16 items-center gap-3 px-4 py-3.5 sm:px-5">
              <span className="text-school-ink"><Icon icon={CheckmarkBadge01Icon} size={22} /></span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{approvals ? `${approvals} result ${approvals === 1 ? 'batch' : 'batches'} to approve` : 'No results waiting for you'}</span>
                <span className="text-[13px] text-text-secondary">Scores sent up by teachers</span>
              </span>
              {approvals ? <span className="rounded-full bg-school px-2.5 py-0.5 text-sm font-semibold tabular-nums text-white">{approvals}</span> : <Icon icon={ArrowRight01Icon} size={18} className="text-text-secondary" />}
            </Link>
          )}
        </div>
      )}

      <Link href="/dashboard/results/remarks" className="flex items-center gap-2 self-start text-sm font-medium text-text-secondary hover:text-primary">
        <Icon icon={Comment01Icon} size={17} /> Write result remarks
      </Link>
    </div>
  )
}
