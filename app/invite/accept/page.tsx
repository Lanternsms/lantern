'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/password-input'
import { AuthLayout, authButton, authError, authLabel } from '@/components/auth/auth-layout'

export default function AcceptInvitePage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function establishInviteSession() {
      // Pull tokens straight from the hash ourselves — don't trust
      // whatever session may already be sitting in cookies.
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')

      if (!access_token || !refresh_token) {
        setError('This invite link is missing its access token. Ask your school admin to resend it.')
        return
      }

      // Clear out any existing session (e.g. an admin testing this in the
      // same browser) before adopting the invite's session.
      await supabase.auth.signOut()

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })

      if (setSessionError) {
        setError('This invite link has expired or was already used. Ask your school admin to resend it.')
        return
      }

      // Strip the tokens from the URL so they're not left sitting in
      // browser history.
      window.history.replaceState(null, '', window.location.pathname)
      setReady(true)
    }

    establishInviteSession()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { data: sessionCheck } = await supabase.auth.getSession()
    if (!sessionCheck.session) {
      setError('This invite link has expired or was already used. Ask your school admin to resend it.')
      setSubmitting(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <AuthLayout title="Set your password" subtitle="Welcome to Lantern. Choose a password to finish setting up your account.">
      {!ready && !error && <p className="text-sm text-text-secondary">Checking your invite link…</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
        <label htmlFor="password" className={authLabel}>
          Password
          <PasswordInput required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </label>
        {error && <p role="alert" className={authError}>{error}</p>}
        <button type="submit" disabled={!ready || submitting} className={authButton}>
          {submitting ? 'Setting your password…' : 'Set password and continue'}
        </button>
      </form>
    </AuthLayout>
  )
}
