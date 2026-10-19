import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Fraunces, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import { CustomCursor } from '@/components/cursor'
import { PaperGrain } from '@/components/design-system'
import { SmoothScrollProvider } from '@/components/providers/smooth-scroll'
import { RaahiSathi } from '@/components/raahi-sathi'

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' })
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' })

export const metadata: Metadata = {
  title: 'Raahi — Share the ride, keep the city moving',
  description: 'Verified commuter carpools for Indian cities.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#F4EDE0',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${jetbrains.variable}`}>
      <body className="antialiased">
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
        <PaperGrain />
        <CustomCursor />
        <RaahiSathi />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
