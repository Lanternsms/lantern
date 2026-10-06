'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/password-input'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function establishRecoverySession() {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const errorDescription = url.searchParams.get('error_description')

      // Supabase redirected back with an error instead of a token
      // (expired link, already used, etc.)
      if (errorDescription) {
        setError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')))
        return
      }

      // PKCE flow: a `code` query param that must be exchanged for a session.
      // This only works in the same browser that requested the reset, since
      // it pairs with a "code verifier" Supabase stored in local storage.
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          setError(
            'This reset link has expired, was already used, or was opened in a different browser than the one you requested it from. Please request a new one.'
          )
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        setReady(true)
        return
      }

      // Fallback: implicit flow, hash-based tokens (#access_token=...)
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')

      if (access_token && refresh_token) {
        await supabase.auth.signOut()
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })
        if (setSessionError) {
          setError('This reset link has expired or was already used. Request a new one.')
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        setReady(true)
        return
      }

      setError('This reset link is invalid or incomplete. Request a new one from the login page.')
    }

    establishRecoverySession()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    const { data: sessionCheck } = await supabase.auth.getSession()
    if (!sessionCheck.session) {
      setError('This reset link has expired or was already used. Request a new one.')
      setSubmitting(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    // Sign out so the person has to log in fresh with the new password,
    // rather than silently inheriting the recovery session's dashboard access.
    await supabase.auth.signOut()
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full bg-surface border border-border rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-text-primary mb-2">Password updated</h1>
          <p className="text-sm text-text-secondary">Redirecting you to login…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-6">
        <h1 className="text-lg font-semibold text-text-primary mb-1">Set a new password</h1>
        <p className="text-sm text-text-secondary mb-5">Choose a new password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">New password</label>
            <PasswordInput
              id="password"
              name="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Confirm password</label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
            />
          </div>

          {error && <p className="text-sm text-danger-text bg-danger-bg rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={!ready || submitting}
            className="w-full bg-primary text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 hover:bg-primary-hover transition-colors"
          >
            {submitting ? 'Updating…' : !ready && !error ? 'Verifying link…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
