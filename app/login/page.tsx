'use client'

import { use, useTransition } from 'react'
import Link from 'next/link'
import { signIn } from '@/app/auth/actions'
import { PasswordInput } from '@/components/password-input'
import { LoadingOverlay } from '@/components/loading-overlay'

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

      <div className="min-h-screen bg-white flex items-center justify-center px-4 relative">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-questrial text-primary mb-8">Log in to your account</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-text-secondary mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Your email address"
                required
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm text-text-secondary">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-text-secondary hover:text-primary">
                  Forgot Password?
                </Link>
              </div>
              <PasswordInput />
            </div>

            {error && (
              <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isPending ? 'Signing in…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}