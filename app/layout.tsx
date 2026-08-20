import { Questrial } from 'next/font/google'
import './globals.css'

const questrial = Questrial({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-questrial',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={questrial.variable}>
      <body>{children}</body>
    </html>
  )
}