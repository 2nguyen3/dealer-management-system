import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

/** Class-based light/dark theme (shadcn dark-mode recipe), persisted per browser. */
export function ThemeProvider({ children }: { children: ReactNode }) {
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
