'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/password-input'
import { AuthLayout, authButton, authError, authLabel } from '@/components/auth/auth-layout'

export default function AcceptInvitePage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function establishInviteSession() {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const errorDescription = url.searchParams.get('error_description')

      if (errorDescription) {
        setError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')))
        return
      }

      // PKCE flow: a `code` query param that must be exchanged for a session.
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          setError(
            'This invite link has expired, was already used, or was opened in a different browser than it was sent to. Ask for a new invite.'
          )
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        setReady(true)
        return
      }

      // Implicit flow: hash-based tokens (#access_token=...&type=invite)
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
          setError('This invite link has expired or was already used. Ask for a new invite.')
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        setReady(true)
        return
      }

      setError('This invite link is invalid or incomplete.')
    }

    establishInviteSession()
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
      setError('This invite link has expired or was already used. Ask for a new invite.')
      setSubmitting(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    await supabase.auth.signOut()
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  if (done) {
    return <AuthLayout title="Account ready" subtitle="Taking you to sign in…"><span /></AuthLayout>
  }

  return (
    <AuthLayout title="Welcome to Lantern" subtitle="Choose a password to finish setting up your account.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
        <label htmlFor="password" className={authLabel}>
          Password
          <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </label>
        <label htmlFor="confirmPassword" className={authLabel}>
          Type it again
          <PasswordInput id="confirmPassword" name="confirmPassword" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="" />
        </label>
        {error && <p role="alert" className={authError}>{error}</p>}
        <button type="submit" disabled={!ready || submitting} className={authButton}>
          {submitting ? 'Setting up…' : !ready && !error ? 'Checking your invite…' : 'Finish setting up'}
        </button>
      </form>
    </AuthLayout>
  )
}
