'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signOut } from '@/app/auth/actions'

export function DashboardShell({
  firstName,
  lastName,
  schoolName,
  logoUrl,
  navItems,
  children,
}: {
  firstName: string
  lastName: string
  schoolName: string
  logoUrl: string | null
  navItems: { label: string; href: string }[]
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
        <div className="relative flex flex-col items-center justify-center gap-1 px-5 py-5 border-b border-text-on-sidebar/10">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={schoolName} className="h-8 max-w-[160px] w-auto object-contain" />
          ) : (
            <span className="text-text-on-sidebar font-semibold text-lg">Lantern</span>
          )}
          <span className="text-text-on-sidebar/80 text-xs font-medium text-center truncate max-w-[180px]">
            {schoolName}
          </span>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
            className="absolute right-5 top-5 text-text-on-sidebar/70 hover:text-text-on-sidebar transition-colors"
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

        <nav className="flex-1 min-h-0 overflow-y-auto sidebar-scrollbar px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-text-on-sidebar/70 hover:text-text-on-sidebar hover:bg-sidebar-active transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-text-on-sidebar/10 space-y-1">
          <Link
            href="/dashboard/help"
            className="block rounded-lg px-3 py-2 text-sm text-text-on-sidebar/70 hover:text-text-on-sidebar hover:bg-sidebar-active transition-colors"
          >
            Help & Support
          </Link>
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm text-text-on-sidebar font-medium">{firstName} {lastName}</p>
            <form action={signOut}>
              <button
                type="submit"
                className="text-xs text-text-on-sidebar/50 hover:text-text-on-sidebar transition-colors"
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

        <div className="flex items-center gap-2 min-w-0">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-6 w-6 rounded object-contain shrink-0" />
          )}
          <span className="text-sm font-medium text-text-primary truncate">{schoolName}</span>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}