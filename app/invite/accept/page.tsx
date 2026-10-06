'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/password-input'

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
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-questrial text-primary mb-2">Set your password</h1>
        <p className="text-sm text-text-secondary mb-8">Welcome to Lantern. Choose a password to finish setting up your account.</p>

        {!ready && !error && (
          <p className="text-sm text-text-secondary mb-4">Verifying your invite link…</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
          />
          {error && <p className="text-sm text-danger-text bg-danger-bg rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={!ready || submitting}
            className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Setting password…' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}