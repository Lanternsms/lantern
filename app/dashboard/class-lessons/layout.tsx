import { redirect } from 'next/navigation'
import { LMS_ENABLED } from '@/lib/features'

// LMS is paused (lib/features.ts); its pages send people back to the dashboard.
export default function PausedLayout({ children }: { children: React.ReactNode }) {
  if (!LMS_ENABLED) redirect('/dashboard')
  return children
}
