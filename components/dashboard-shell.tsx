'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpen, CalendarCheck, CalendarDays, ClipboardCheck, FileText, FolderOpen, GraduationCap,
  HelpCircle, Home, KeyRound, LogOut, Megaphone, Menu, MessageCircleQuestion, NotebookPen,
  Receipt, Settings, ShieldCheck, Users, UserRound, UsersRound, Wallet, X, type LucideIcon,
  HardDrive, PlayCircle, ListChecks, Tags,
} from 'lucide-react'
import { signOut } from '@/app/auth/actions'
import { removeSubscription } from '@/app/dashboard/notifications/actions'
import { GlobalSearch } from '@/components/global-search'
import { LoadingOverlay } from '@/components/loading-overlay'

type NavItem = { label: string; href: string; badge?: number | string | null }

const ICONS: Record<string, LucideIcon> = {
  '/dashboard': Home,
  '/dashboard/students': UsersRound,
  '/dashboard/guardians': UserRound,
  '/dashboard/staff': Users,
  '/dashboard/academics': GraduationCap,
  '/dashboard/roles': ShieldCheck,
  '/dashboard/gradebook': NotebookPen,
  '/dashboard/approvals': ClipboardCheck,
  '/dashboard/academics/timetable': CalendarDays,
  '/dashboard/my-timetable': CalendarDays,
  '/dashboard/class-lessons': PlayCircle,
  '/dashboard/class-results': ListChecks,
  '/dashboard/results/remarks': FileText,
  '/dashboard/my-submissions': ListChecks,
  '/dashboard/my-class': UsersRound,
  '/dashboard/results': FileText,
  '/dashboard/my-results': FileText,
  '/dashboard/users': KeyRound,
  '/dashboard/attendance': CalendarCheck,
  '/dashboard/attendance/settings': Tags,
  '/dashboard/fees/structures': Wallet,
  '/dashboard/fees/record': Receipt,
  '/dashboard/payments': Wallet,
  '/dashboard/announcements': Megaphone,
  '/dashboard/documents': FolderOpen,
  '/dashboard/settings': Settings,
  '/dashboard/lms': BookOpen,
  '/dashboard/lms/today': PlayCircle,
  '/dashboard/lms/my-lessons': BookOpen,
  '/dashboard/lms/questions': MessageCircleQuestion,
  '/dashboard/lms/storage': HardDrive,
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

  // The same href can appear twice for different roles (e.g. My Timetable); show it once.
  const items = navItems.filter((item, i) => navItems.findIndex((x) => x.href === item.href) === i)
  const current = activeHref(pathname, items)
  const daily = items.filter((i) => !SETUP_HREFS.has(i.href))
  const setup = items.filter((i) => SETUP_HREFS.has(i.href))

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
    const Icon = ICONS[item.href] ?? FileText
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
        className={`flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
          on
            ? 'bg-school-soft font-semibold text-school-ink'
            : 'text-[#374151] hover:bg-black/[0.04] hover:text-text-primary'
        }`}
      >
        <Icon aria-hidden size={16} strokeWidth={1.6} className={on ? 'text-school' : 'text-text-secondary'} />
        <span className="flex-1 truncate">{item.label}</span>
        {typeof item.badge === 'number' && item.badge > 0 ? (
          <span className={`text-xs tabular-nums ${on ? 'text-school-ink' : 'text-text-secondary'}`}>{item.badge}</span>
        ) : null}
      </Link>
    )
  }

  const crest = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" />
  ) : (
    <svg aria-hidden width="28" height="32" viewBox="0 0 30 34" className="shrink-0">
      <path d="M15 1 28 5v11c0 8-5.5 13.5-13 17C7.5 29.5 2 24 2 16V5z" fill="var(--color-school)" />
      <path d="M15 8v15M9 13h12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )

  const sidebar = (
    <div className="flex h-full flex-col px-3 pb-4 pt-5">
      <div className="flex items-center gap-2.5 px-1.5">
        {crest}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{schoolName || 'Your school'}</span>
        <div className="shrink-0">{notificationBell}</div>
      </div>

      <div className="mt-4 px-0.5">
        <GlobalSearch />
      </div>

      <nav aria-label="Main" className="sidebar-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5">{daily.map(navLink)}</div>
        {setup.length > 0 && (
          <>
            <p className="mb-1.5 mt-7 px-2.5 text-xs text-text-secondary">School setup</p>
            <div className="flex flex-col gap-0.5">{setup.map(navLink)}</div>
          </>
        )}
      </nav>

      <div className="mt-3 flex flex-col gap-0.5 border-t border-border pt-3">
        <Link
          href="/dashboard/help"
          className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm text-[#374151] hover:bg-black/[0.04]"
        >
          <HelpCircle aria-hidden size={16} strokeWidth={1.6} className="text-text-secondary" />
          Help and support
        </Link>
        <div className="mt-1 flex items-center gap-2.5 px-2 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fde7d9] text-xs font-semibold text-[#7c2d12]">
            {initials || '?'}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{firstName} {lastName}</span>
          <form action={handleSignOut}>
            <button
              type="submit"
              aria-label="Log out"
              title="Log out"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-black/[0.05] hover:text-text-primary"
            >
              <LogOut aria-hidden size={16} strokeWidth={1.6} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-ground">
      {showLoader && <LoadingOverlay message={isSigningOut ? 'Signing out…' : 'Loading…'} />}

      {/* Desktop: the sidebar sits on the page ground, separated by one hairline. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-ground lg:block">
        {sidebar}
      </aside>

      {/* Phone and tablet: a 52px bar with the school, and the nav in a sheet. */}
      <header className="sticky top-0 z-20 flex h-13 items-center gap-2 border-b border-border bg-surface/95 px-2 backdrop-blur lg:hidden">
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
          aria-expanded={isOpen}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-text-primary"
        >
          <Menu aria-hidden size={20} strokeWidth={1.6} />
        </button>
        {crest}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{schoolName}</span>
        {notificationBell}
      </header>

      <div
        onClick={() => setIsOpen(false)}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        aria-label="Menu"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`fixed inset-y-0 left-0 z-50 w-[min(300px,86vw)] bg-ground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden ${
          isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
          className="absolute right-2 top-3 flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
        >
          <X aria-hidden size={18} strokeWidth={1.6} />
        </button>
        {sidebar}
      </aside>

      <main className="min-w-0 lg:pl-60">{children}</main>
    </div>
  )
}
