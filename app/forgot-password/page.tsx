'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createPasswordResetClient } from '@/lib/supabase/password-reset-client'
import { LoadingOverlay } from '@/components/loading-overlay'
import { AuthLayout, authButton, authError, authInput, authLabel, authLink } from '@/components/auth/auth-layout'

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
      <AuthLayout
        title="Check your email"
        subtitle={<>If an account exists for <strong className="font-medium text-text-primary">{email}</strong>, we’ve sent a link to set a new password. It expires soon, so use it today.</>}
      >
        <Link href="/login" className={authLink}>Back to sign in</Link>
      </AuthLayout>
    )
  }

  return (
    <>
      {submitting && <LoadingOverlay message="Sending reset link…" />}
      <AuthLayout title="Reset your password" subtitle="Enter the email on your account and we’ll send you a link to set a new password.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
          <label className={authLabel}>
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
          </label>
          {error && <p role="alert" className={authError}>{error}</p>}
          <button type="submit" disabled={submitting} className={authButton}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <Link href="/login" className={`${authLink} self-start text-sm`}>Back to sign in</Link>
      </AuthLayout>
    </>
  )
}
