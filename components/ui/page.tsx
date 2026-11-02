import Link from 'next/link'
import type { IconSvgElement } from '@hugeicons/react'
import { Icon } from '@/components/icon'

/** Shared building blocks for inner pages, so every list and form page has one voice. */

export const field =
  'h-11 sm:h-10 rounded-xl border border-control bg-surface px-3 text-base sm:text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-school-soft'

const BTN = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-surface text-text-primary shadow-card ring-1 ring-black/[0.06] hover:bg-raised',
  quiet: 'bg-raised text-text-primary hover:bg-school-soft hover:text-school-ink',
} as const

export function buttonClass(kind: keyof typeof BTN = 'primary') {
  return `inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ${BTN[kind]}`
}

export function ButtonLink({
  href, children, kind = 'primary', icon,
}: { href: string; children: React.ReactNode; kind?: keyof typeof BTN; icon?: IconSvgElement }) {
  return (
    <Link href={href} className={buttonClass(kind)}>
      {icon && <Icon icon={icon} size={17} />}
      {children}
    </Link>
  )
}

export function PageShell({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return <div className={`flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8 ${narrow ? 'max-w-3xl' : ''}`}>{children}</div>
}

export function PageHeader({
  title, subtitle, actions, back,
}: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col gap-2">
      {back && (
        <Link href={back.href} className="w-fit text-sm text-text-secondary hover:text-text-primary">← {back.label}</Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-[28px] font-semibold leading-tight sm:text-[34px]">{title}</h1>
          {subtitle && <p className="text-[15px] text-text-secondary">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-2 p-8">
      <span className="font-display text-lg font-semibold">{title}</span>
      {body && <span className="max-w-[56ch] text-text-secondary">{body}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

const TINTS = ['bg-[#fde7d9] text-[#7c2d12]', 'bg-school-soft text-school-ink', 'bg-[#dcfce7] text-[#14532d]', 'bg-[#fae8ff] text-[#701a75]', 'bg-[#fef9c3] text-[#713f12]', 'bg-[#e0f2fe] text-[#0c4a6e]']

/** A person's initials on a stable pale tint, or their photo. */
export function Avatar({ first, last, photo, size = 36 }: { first: string; last: string; photo?: string | null; size?: number }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  const key = (first + last).split('').reduce((n, ch) => n + ch.charCodeAt(0), 0)
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full text-xs font-semibold ${TINTS[key % TINTS.length]}`} style={{ width: size, height: size }}>
      {(first[0] ?? '').toUpperCase()}{(last[0] ?? '').toUpperCase()}
    </span>
  )
}

export function StatusPill({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'neutral' | 'school'; children: React.ReactNode }) {
  const t = {
    success: 'bg-success-bg text-success-text', warning: 'bg-warning-bg text-warning-text', danger: 'bg-danger-bg text-danger-text',
    neutral: 'bg-raised text-[#374151]', school: 'bg-school-soft text-school-ink',
  }[tone]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${t}`}>{children}</span>
}

export { safeSearch } from '@/lib/safe-search'

/** A grid of destinations for hub pages (Settings, Academics). */
export function HubGrid({ items }: { items: { href: string; title: string; description: string; icon: IconSvgElement }[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((it) => (
        <li key={it.href}>
          <Link href={it.href} className="card group flex h-full items-start gap-4 p-5 transition-transform duration-200 hover:-translate-y-0.5">
            <Icon icon={it.icon} size={22} className="mt-0.5 shrink-0 text-school" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-display text-[17px] font-semibold">{it.title}</span>
              <span className="text-sm text-text-secondary">{it.description}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
