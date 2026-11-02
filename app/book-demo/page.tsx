import type { Metadata } from 'next'
import { AuthLayout } from '@/components/auth/auth-layout'
import { DemoForm } from './demo-form'

export const metadata: Metadata = {
  title: 'Book a demo · Lantern',
  description: 'See Lantern with your own school’s data in a free 30-minute call.',
}

export default function BookDemoPage() {
  return (
    <AuthLayout title="Book a demo" subtitle="A free 30-minute call. Tell us about your school and we’ll call you to pick a time.">
      <DemoForm />
    </AuthLayout>
  )
}
