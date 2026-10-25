import { Questrial } from 'next/font/google'
import './globals.css'
import { OfflineBanner } from '@/components/offline-banner'

import type { Metadata, Viewport } from 'next'

const questrial = Questrial({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-questrial',
})

export const metadata: Metadata = {
  title: 'Lantern',
  description: 'School Management & Learning Platform',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lantern',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#182350',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={questrial.variable}>
      <body>
        <OfflineBanner />
        {children}
      </body>
    </html>
  )
}