'use client'

import { use, useTransition } from 'react'
import Link from 'next/link'
import { signIn } from '@/app/auth/actions'
import { PasswordInput } from '@/components/password-input'
import { LoadingOverlay } from '@/components/loading-overlay'
import { AuthLayout, authButton, authError, authInput, authLabel } from '@/components/auth/auth-layout'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = use(searchParams)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      await signIn(formData)
    })
  }

  return (
    <>
      {isPending && <LoadingOverlay message="Signing you in…" />}

      <AuthLayout title="Sign in" subtitle="Staff, students and guardians all sign in here.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
          <label htmlFor="email" className={authLabel}>
            Email
            <input id="email" name="email" type="email" autoComplete="username" required className={authInput} />
          </label>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Link href="/forgot-password" className="text-sm text-text-secondary hover:text-text-primary">
                Forgot it?
              </Link>
            </div>
            <PasswordInput autoComplete="current-password" placeholder="" required />
          </div>

          {error && <p role="alert" className={authError}>{error}</p>}

          <button type="submit" disabled={isPending} className={authButton}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-sm text-text-secondary">
          First time here? Open the invite your school sent to your email.
        </p>
      </AuthLayout>
    </>
  )
}
