import type { Metadata } from 'next'
import { Outfit, Libre_Caslon_Text } from 'next/font/google'
import './globals.css'
import SessionGuard from './components/SessionGuard'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
})

const libreCaslon = Libre_Caslon_Text({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-libre-caslon',
})

export const metadata: Metadata = {
  title: 'Gamer Matcher',
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
      className={`${outfit.variable} ${libreCaslon.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionGuard />
        {children}
      </body>
    </html>
  )
}
