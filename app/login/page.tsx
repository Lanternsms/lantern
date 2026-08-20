import { signIn } from '@/app/auth/actions'
import Link from 'next/link'
import { PasswordInput } from '@/components/password-input'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 relative">
      <Link
        href="/signup"
        className="absolute top-6 right-6 text-sm text-text-primary border border-border rounded-full px-4 py-1.5 hover:bg-surface-muted transition-colors"
      >
        Create Account
      </Link>

      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-questrial text-primary mb-8">Log in to your account</h1>

        <form action={signIn} className="space-y-4">
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
            className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
          >
            Log in
          </button>
        </form>
      </div>
    </div>
  )
}