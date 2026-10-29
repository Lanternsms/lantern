import { DM_Sans } from 'next/font/google'
import './globals.css'
import { OfflineBanner } from '@/components/offline-banner'

import type { Metadata, Viewport } from 'next'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Lantern',
  description: 'Registers, results, fees and lessons for Nigerian secondary schools, in one place.',
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
  themeColor: '#0c0f14',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        <OfflineBanner />
        {children}
      </body>
    </html>
  )
}