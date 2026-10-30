'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { IconSvgElement } from '@hugeicons/react'
import {
  Analytics01Icon, BookOpen01Icon, Calendar03Icon, CalendarCheckIn01Icon, Cancel01Icon, CheckListIcon,
  File01Icon, Folder01Icon, HardDriveIcon, HelpCircleIcon, Home01Icon, Invoice01Icon, Key01Icon, LicenseIcon,
  Logout01Icon, Megaphone01Icon, Menu01Icon, Message01Icon, Mortarboard01Icon, Note01Icon, PlayCircleIcon,
  Settings01Icon, ShieldUserIcon, Tag01Icon, TaskDone01Icon, UserGroupIcon, UserIcon, UserMultipleIcon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons'
import { signOut } from '@/app/auth/actions'
import { removeSubscription } from '@/app/dashboard/notifications/actions'
import { GlobalSearch } from '@/components/global-search'
import { LoadingOverlay } from '@/components/loading-overlay'
import { Icon } from '@/components/icon'

type NavItem = { label: string; href: string; badge?: number | string | null }

const ICONS: Record<string, IconSvgElement> = {
  '/dashboard': Home01Icon,
  '/dashboard/students': UserGroupIcon,
  '/dashboard/guardians': UserIcon,
  '/dashboard/staff': UserMultipleIcon,
  '/dashboard/academics': Mortarboard01Icon,
  '/dashboard/roles': ShieldUserIcon,
  '/dashboard/gradebook': Note01Icon,
  '/dashboard/approvals': TaskDone01Icon,
  '/dashboard/academics/timetable': Calendar03Icon,
  '/dashboard/my-timetable': Calendar03Icon,
  '/dashboard/class-lessons': PlayCircleIcon,
  '/dashboard/class-results': Analytics01Icon,
  '/dashboard/results/remarks': Message01Icon,
  '/dashboard/my-submissions': CheckListIcon,
  '/dashboard/my-class': UserGroupIcon,
  '/dashboard/results': LicenseIcon,
  '/dashboard/my-results': LicenseIcon,
  '/dashboard/users': Key01Icon,
  '/dashboard/attendance': CalendarCheckIn01Icon,
  '/dashboard/attendance/settings': Tag01Icon,
  '/dashboard/fees/structures': Wallet01Icon,
  '/dashboard/fees/record': Invoice01Icon,
  '/dashboard/payments': Wallet01Icon,
  '/dashboard/announcements': Megaphone01Icon,
  '/dashboard/documents': Folder01Icon,
  '/dashboard/settings': Settings01Icon,
  '/dashboard/lms': BookOpen01Icon,
  '/dashboard/lms/today': PlayCircleIcon,
  '/dashboard/lms/my-lessons': BookOpen01Icon,
  '/dashboard/lms/questions': Message01Icon,
  '/dashboard/lms/storage': HardDriveIcon,
}

// Setup pages are visited a few times a term; they sit in their own group below the daily work.
const SETUP_HREFS = new Set([
  '/dashboard/academics', '/dashboard/roles', '/dashboard/users', '/dashboard/attendance/settings',
  '/dashboard/fees/structures', '/dashboard/lms/storage', '/dashboard/settings',
])

/** The nav item whose href is the longest prefix of the current path is the active one. */
function activeHref(pathname: string, items: NavItem[]) {
  let best = ''
  for (const item of items) {
    const h = item.href
    if ((pathname === h || pathname.startsWith(h + '/')) && h.length > best.length) best = h
  }
  return best
}

export function DashboardShell({
  firstName,
  lastName,
  schoolName,
  logoUrl,
  navItems,
  notificationBell,
  children,
}: {
  firstName: string
  lastName: string
  schoolName: string
  logoUrl: string | null
  navItems: NavItem[]
  notificationBell?: React.ReactNode
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // The same href can appear twice for different roles (e.g. My timetable); show it once.
  const items = navItems.filter((item, i) => navItems.findIndex((x) => x.href === item.href) === i)
  const current = activeHref(pathname, items)
  const daily = items.filter((i) => !SETUP_HREFS.has(i.href))
  const setup = items.filter((i) => SETUP_HREFS.has(i.href))
  const currentLabel = items.find((i) => i.href === current)?.label ?? ''

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  function navigate(href: string) {
    setIsOpen(false)
    startTransition(() => {
      router.push(href)
    })
  }

  async function handleSignOut(_formData?: FormData) {
    setIsSigningOut(true)
    try {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
        const cleanupPromise = async () => {
          const reg = await navigator.serviceWorker.getRegistration()
          if (reg?.pushManager) {
            const sub = await reg.pushManager.getSubscription()
            if (sub) {
              const ep = sub.endpoint
              await sub.unsubscribe().catch(() => {})
              await removeSubscription({ endpoint: ep }).catch(() => {})
            }
          }
        }
        await Promise.race([
          cleanupPromise(),
          new Promise((resolve) => setTimeout(resolve, 800)),
        ])
      }
      try {
        sessionStorage.removeItem('push_synced')
      } catch {
        // Ignore sessionStorage error
      }
    } catch (e) {
      console.debug('Error unsubscribing before sign out:', e)
    }
    await signOut()
  }

  const showLoader = isPending || isSigningOut
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()

  const navLink = (item: NavItem) => {
    const on = item.href === current
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return
          e.preventDefault()
          navigate(item.href)
        }}
        aria-current={on ? 'page' : undefined}
        className={`group flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors duration-150 ${
          on
            ? 'bg-white font-semibold text-school-deep shadow-[0_1px_2px_rgb(0_0_0/0.2)]'
            : 'text-school-deep-muted hover:bg-school-deep-raised hover:text-white'
        }`}
      >
        <Icon icon={ICONS[item.href] ?? File01Icon} size={19} className={on ? 'text-school' : ''} />
        <span className="flex-1 truncate">{item.label}</span>
        {typeof item.badge === 'number' && item.badge > 0 ? (
          <span className={`min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums leading-5 ${on ? 'bg-school-soft text-school-ink' : 'bg-white/15 text-white'}`}>
            {item.badge}
          </span>
        ) : null}
      </Link>
    )
  }

  const crest = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
      <svg aria-hidden width="20" height="23" viewBox="0 0 30 34">
        <path d="M15 1 28 5v11c0 8-5.5 13.5-13 17C7.5 29.5 2 24 2 16V5z" fill="var(--color-school)" />
        <path d="M15 8v15M9 13h12" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  )

  const sidebar = (mobile: boolean) => (
    <div className="flex h-full flex-col px-3.5 pb-4 pt-5 text-white">
      <div className="flex items-center gap-3 px-1.5">
        {crest}
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-display text-[15px] font-semibold leading-tight">{schoolName || 'Your school'}</span>
          <span className="text-xs text-school-deep-muted">on Lantern</span>
        </span>
      </div>
      {mobile && <div className="mt-5 px-0.5"><GlobalSearch /></div>}

      <nav aria-label="Main" className="sidebar-scrollbar mt-7 min-h-0 flex-1 overflow-y-auto pr-0.5">
        <div className="flex flex-col gap-1">{daily.map(navLink)}</div>
        {setup.length > 0 && (
          <>
            <p className="mb-2 mt-7 px-3 text-xs text-school-deep-muted">School setup</p>
            <div className="flex flex-col gap-1">{setup.map(navLink)}</div>
          </>
        )}
      </nav>

      <div className="mt-3 flex flex-col gap-1 border-t border-white/10 pt-3">
        <Link href="/dashboard/help" className="flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] text-school-deep-muted hover:bg-school-deep-raised hover:text-white">
          <Icon icon={HelpCircleIcon} size={19} />
          Help and support
        </Link>
        <div className="mt-1 flex items-center gap-3 rounded-xl bg-school-deep-raised/60 px-2.5 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fde7d9] text-xs font-semibold text-[#7c2d12]">
            {initials || '?'}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{firstName} {lastName}</span>
          <form action={handleSignOut}>
            <button type="submit" aria-label="Log out" title="Log out" className="flex h-9 w-9 items-center justify-center rounded-lg text-school-deep-muted hover:bg-white/10 hover:text-white">
              <Icon icon={Logout01Icon} size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-ground">
      {showLoader && <LoadingOverlay message={isSigningOut ? 'Signing out…' : 'Loading…'} />}

      {/* Desktop: the deep sidebar in the school's own colour. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] bg-school-deep lg:block">{sidebar(false)}</aside>

      {/* Desktop top bar: where you are, search, notifications. Phones get a compact bar instead. */}
      <header className="sticky top-0 z-20 hidden h-16 items-center gap-4 border-b border-black/[0.05] bg-ground/85 px-8 backdrop-blur-md lg:ml-[264px] lg:flex">
        <span className="font-display text-[15px] font-semibold text-text-secondary">{currentLabel}</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="w-72"><GlobalSearch /></div>
          {notificationBell}
        </div>
      </header>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-school-deep px-2 text-white lg:hidden">
        <button onClick={() => setIsOpen(true)} aria-label="Open menu" aria-expanded={isOpen} className="flex h-11 w-11 items-center justify-center rounded-lg">
          <Icon icon={Menu01Icon} size={22} />
        </button>
        <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold">{currentLabel || schoolName}</span>
        <span className="rounded-lg bg-white/95 text-text-primary">{notificationBell}</span>
      </header>

      <div
        onClick={() => setIsOpen(false)}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 lg:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <aside
        aria-label="Menu"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`fixed inset-y-0 left-0 z-50 w-[min(300px,86vw)] bg-school-deep transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      >
        <button onClick={() => setIsOpen(false)} aria-label="Close menu" className="absolute right-2 top-3.5 flex h-10 w-10 items-center justify-center rounded-lg text-school-deep-muted hover:text-white">
          <Icon icon={Cancel01Icon} size={20} />
        </button>
        {sidebar(true)}
      </aside>

      <main className="min-w-0 lg:pl-[264px]">{children}</main>
    </div>
  )
}
