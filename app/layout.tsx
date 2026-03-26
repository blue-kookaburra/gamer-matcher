import type { Metadata } from 'next'
import { DM_Sans, Syne, Instrument_Serif } from 'next/font/google'
import './globals.css'
import SessionGuard from './components/SessionGuard'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
})

export const metadata: Metadata = {
  title: 'Tabletop Tally',
  description: 'Tinder-style board game voting for game night',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${syne.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionGuard />
        {children}
      </body>
    </html>
  )
}
