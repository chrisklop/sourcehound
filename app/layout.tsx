import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "next-themes"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "SourceHound - AI-Powered Claim Debunking",
  description:
    "Chat with AI to debunk claims, find sources, and verify information. Persistent conversations with comprehensive source analysis.",
  keywords: "fact check, AI, verification, sources, claims, debunk, chat",
  authors: [{ name: "SourceHound" }],
  creator: "SourceHound",
  publisher: "SourceHound",
  robots: "index, follow",
  openGraph: {
    title: "SourceHound - AI-Powered Claim Debunking",
    description: "Chat with AI to debunk claims and find reliable sources.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SourceHound - AI-Powered Claim Debunking",
    description: "Chat with AI to debunk claims and find reliable sources.",
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange={false}>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <div id="main-content" style={{ position: 'relative', zIndex: 1 }}>{children}</div>
        </ThemeProvider>
      </body>
    </html>
  )
}
