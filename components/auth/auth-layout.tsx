import Image from 'next/image'
import Link from 'next/link'

/** Shared form styles for every page that runs before anyone is signed in. */
export const authLabel = 'flex flex-col gap-1.5 text-sm font-medium text-text-primary'
export const authInput =
  'h-11 w-full rounded-lg border border-control bg-white px-3 text-[15px] font-normal text-text-primary placeholder:text-text-muted focus:border-[#0c0f14] focus:outline-none focus:ring-2 focus:ring-[#0c0f14]/15'
export const authButton =
  'flex h-11 w-full items-center justify-center rounded-lg bg-[#0c0f14] text-[15px] font-semibold text-white hover:bg-[#262b34] disabled:cursor-not-allowed disabled:opacity-60'
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
          <svg aria-hidden width="20" height="23" viewBox="0 0 24 28">
            <path d="M8 3h8M12 0v3" stroke="#0c0f14" strokeWidth="2" />
            <path d="M5 6h14l3 4v12l-3 4H5l-3-4V10z" fill="#0c0f14" />
            <path d="M12 11c2.6 2.4 2.6 6.6 0 9-2.6-2.4-2.6-6.6 0-9z" fill="#f2b441" />
          </svg>
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
      <figure className="relative m-0 hidden flex-1 lg:block">
        <Image
          src="/landing/digital-classroom.jpg"
          alt="Pupils in blue uniforms working on laptops while their teacher leans in to help"
          fill
          sizes="50vw"
          priority
          className="object-cover"
        />
        <figcaption className="absolute inset-x-6 bottom-6 rounded-xl bg-[#0c0f14]/80 px-4 py-3 text-[15px] leading-snug text-white">
          Registers, results, fees and lessons — one place for the whole school.
        </figcaption>
      </figure>
    </div>
  )
}
