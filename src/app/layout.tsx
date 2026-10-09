import type { Metadata, Viewport } from 'next'

import { Geist, Geist_Mono } from 'next/font/google'

import { OfflineGate } from '@/components/offline-gate'
import { ServiceWorker } from '@/components/service-worker'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Govinda Tyre Puncture',
    template: '%s | Govinda Tyre Puncture',
  },
  description: 'Billing, sales and salary management for Govinda Tyre Puncture.',
  applicationName: 'Govinda Tyre Puncture',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Govinda Tyre',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Needed for the sticky bottom navigation to sit above the home indicator.
  viewportFit: 'cover',
  themeColor: '#1d45f5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ServiceWorker />
        <OfflineGate>{children}</OfflineGate>
      </body>
    </html>
  )
}