import Link from 'next/link'
import { AuthLayout, authButton } from '@/components/auth/auth-layout'

export default function SessionExpiredPage() {
  return (
    <AuthLayout
      title="You’ve been signed out"
      subtitle="For your security, Lantern signs you out after a while without activity. Sign in again to carry on where you left off."
    >
      <Link href="/login" className={authButton}>Sign in again</Link>
    </AuthLayout>
  )
}
