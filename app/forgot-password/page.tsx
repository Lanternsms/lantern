'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createPasswordResetClient } from '@/lib/supabase/password-reset-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const supabase = createPasswordResetClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    })

    setSubmitting(false)

    // Always show the same success message, whether or not the email
    // exists in the system — don't leak which emails have accounts.
    if (error && error.status !== 400) {
      // 400s from Supabase here are almost always rate-limit related;
      // surface those, but swallow "user not found"-style responses.
      setError('Something went wrong sending the reset email. Please try again shortly.')
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full bg-surface border border-border rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-text-primary mb-2">Check your email</h1>
          <p className="text-sm text-text-secondary">
            If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a
            link to reset your password. The link expires after a short while, so use it soon.
          </p>
          <Link
            href="/login"
            className="inline-block mt-4 text-sm text-primary hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-6">
        <h1 className="text-lg font-semibold text-text-primary mb-1">Reset your password</h1>
        <p className="text-sm text-text-secondary mb-5">
          Enter the email address linked to your account and we&apos;ll send you a link to set a new
          password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary"
              placeholder="you@example.com"
            />
          </div>

          {error && <p className="text-sm text-danger-text bg-danger-bg rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 hover:bg-primary-hover transition-colors"
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <Link href="/login" className="block mt-4 text-sm text-primary hover:underline text-center">
          Back to login
        </Link>
      </div>
    </div>
  )
}
