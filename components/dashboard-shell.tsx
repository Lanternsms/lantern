'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signOut } from '@/app/auth/actions'

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Students', href: '/dashboard/students' },
  { label: 'Staff', href: '/dashboard/staff' },
  { label: 'Academics', href: '/dashboard/academics' },
  { label: 'Timetable', href: '/dashboard/timetable' },
  { label: 'Results', href: '/dashboard/results' },
  { label: 'Attendance', href: '/dashboard/attendance' },
  { label: 'Fees & Payments', href: '/dashboard/fees' },
  { label: 'Communication', href: '/dashboard/communication' },
]

export function DashboardShell({
  firstName,
  lastName,
  schoolName,
  children,
}: {
  firstName: string
  lastName: string
  schoolName: string
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 bg-black/30 z-30 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-sidebar flex flex-col z-40 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <span className="text-white font-semibold text-lg">Lantern</span>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
            className="text-white/70 hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5l10 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-sidebar-active transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <Link
            href="/dashboard/help"
            className="block rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-sidebar-active transition-colors"
          >
            Help & Support
          </Link>
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm text-white font-medium">{firstName} {lastName}</p>
            <form action={signOut}>
              <button
                type="submit"
                className="text-xs text-white/50 hover:text-white transition-colors"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Top bar — hamburger opens the sidebar */}
      <header className="h-14 bg-surface border-b border-border flex items-center gap-4 px-6">
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
          className="text-text-primary cursor-pointer"
        >
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
            <path
              d="M0 1h22M0 8h22M0 15h22"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <span className="text-sm font-medium text-text-primary">{schoolName}</span>
      </header>

      <main>{children}</main>
    </div>
  )
}