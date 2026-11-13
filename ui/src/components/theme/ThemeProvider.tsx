import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useEffect, type ReactNode } from 'react'
import { readStoredPalette, setPalette } from './palette'

/** Class-based light/dark theme plus the stored colour palette (shadcn dark-mode recipe), persisted per browser. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Colour palette is independent of light/dark; restore it on start.
  useEffect(() => setPalette(readStoredPalette()), [])
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="agentra-theme"
    >
      {children}
    </NextThemesProvider>
  )
}
