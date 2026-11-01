import Image from 'next/image'
import Link from 'next/link'

/** Shared form styles for every page that runs before anyone is signed in. */
export const authLabel = 'flex flex-col gap-1.5 text-sm font-medium text-text-primary'
export const authInput =
  'h-11 w-full rounded-lg border border-control bg-white px-3 text-[15px] font-normal text-text-primary placeholder:text-text-muted focus:border-[#023879] focus:outline-none focus:ring-2 focus:ring-[#023879]/15'
export const authButton =
  'flex h-11 w-full items-center justify-center rounded-lg bg-[#023879] text-[15px] font-semibold text-white hover:bg-[#023067] disabled:cursor-not-allowed disabled:opacity-60'
export const authError = 'rounded-lg bg-danger-bg px-3 py-2.5 text-sm text-danger-text'
export const authLink = 'font-medium text-text-primary underline decoration-control underline-offset-4 hover:decoration-text-primary'

/**
 * Before sign-in we don't know which school someone belongs to, so these pages wear
 * Lantern's own colours: form on the left, a classroom on the right (hidden on phones).
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-[#fafafa] text-text-primary">
      <div className="flex min-w-0 flex-1 flex-col px-5 py-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 self-start text-[17px] font-bold tracking-[-0.01em]">
          <Image src="/icon-192.png" alt="" width={28} height={28} className="h-7 w-7" priority />
          Lantern
        </Link>
        <main className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center gap-7 py-12">
          <div className="flex flex-col gap-2">
            <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
            {subtitle && <p className="text-[15px] text-text-secondary">{subtitle}</p>}
          </div>
          {children}
        </main>
        <p className="text-[13px] text-text-secondary">
          <Link href="/privacy" className="hover:text-text-primary">Privacy</Link>
          {' · '}
          <Link href="/terms" className="hover:text-text-primary">Terms</Link>
        </p>
      </div>
      <aside aria-hidden className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[#023879] p-12 text-white lg:flex">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white">
          <Image src="/icon-192.png" alt="" width={48} height={48} className="h-12 w-12" />
        </span>
        <div className="flex max-w-[420px] flex-col gap-4">
          <p className="font-display text-[40px] font-semibold leading-[1.1]">Your whole school, in one place.</p>
          <p className="text-lg text-white/75">Registers, results, fees and lessons — and every parent hears what happened the minute it does.</p>
        </div>
        <span className="h-1 w-16 rounded-full bg-[#fdb104]" />
      </aside>
    </div>
  )
}
