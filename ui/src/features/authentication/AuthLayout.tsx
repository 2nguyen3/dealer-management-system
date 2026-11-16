import type { ReactNode } from 'react'
import { IllustratedFigure } from '../../components/blocks/IllustratedFigure'
import { BRAND_LOGO, BrandLogo } from '../../components/brand/BrandLogo'
import { LanguagePicker } from '../../components/i18n/LanguagePicker'
import { ModeToggle } from '../../components/theme/ModeToggle'
import { t } from '@/lib/i18n/core'

export interface AuthLayoutProps {
  title: string
  description: string
  /** Optional lucide icon shown in a tile above the form title. */
  icon?: ReactNode
  children: ReactNode
}

/**
 * Split-screen frame for the public authentication pages. The brand panel
 * uses the sidebar tokens, so it matches the workspace navigation in every
 * palette and in both light and dark mode; its decoration is static CSS and
 * the figure only animates while hovered. The form side stays plain and
 * roomy, with the language and theme menus available before signing in.
 */
export function AuthLayout({
  title,
  description,
  icon,
  children,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:p-3">
      <aside
        aria-label={t('Giới thiệu Agentra')}
        data-testid="auth-intro"
        className="relative isolate hidden overflow-hidden rounded-[1.75rem] bg-sidebar text-sidebar-foreground ring-1 ring-sidebar-border lg:flex lg:flex-col lg:p-10 xl:p-14"
      >
        <AuthBackdrop />
        <img
          src={BRAND_LOGO.dark}
          alt="Agentra"
          className="h-11 w-auto self-start object-contain"
        />
        <div className="mt-12 max-w-xl space-y-4 xl:mt-16">
          <h2 className="text-4xl leading-[1.08] font-semibold tracking-[-0.025em] text-balance text-white xl:text-[3.25rem]">
            {t('Từ nhà máy đến đại lý, trong một hệ thống.')}
          </h2>
          <p className="max-w-md text-base text-pretty text-sidebar-foreground/85">
            {t('Sản xuất, giao hàng và bán hàng của mạng lưới đại lý.')}
          </p>
        </div>
        <IllustratedFigure
          name="supplychain.html"
          tone="dark"
          title={t(
            'Minh họa động: nhà máy sản xuất, xe giao hàng và đại lý nhận hàng, bán hàng',
          )}
          className="relative -mx-4 mt-6 min-h-72 flex-1 xl:-mx-6"
        />
        <p className="mt-4 text-xs text-sidebar-foreground/55">
          © {new Date().getFullYear()} Agentra
        </p>
      </aside>

      <div className="relative flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6 lg:justify-end">
          {/* Wrapped: the dark variant's dark:block would beat lg:hidden. */}
          <span className="flex lg:hidden">
            <BrandLogo className="h-9" />
          </span>
          <div className="flex items-center gap-2">
            <LanguagePicker compact />
            <ModeToggle />
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-5 pt-8 pb-16 sm:px-10">
          <div className="w-full max-w-[25rem] animate-in duration-500 fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
            {icon && (
              <span
                aria-hidden="true"
                data-testid="auth-title-icon"
                className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 [&_svg]:size-6"
              >
                {icon}
              </span>
            )}
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-pretty text-muted-foreground sm:text-[0.95rem]">
              {description}
            </p>
            <div className="mt-8 [&_[data-slot=input]]:h-11 [&_[data-slot=input]]:rounded-lg [&_button[type=submit]]:h-11 [&_button[type=submit]]:rounded-lg [&_button[type=submit]]:shadow-md [&_button[type=submit]]:shadow-primary/20">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/** Static panel decoration: soft glows, a fading dot grid and film grain. */
function AuthBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
    >
      <div className="absolute -top-40 -right-32 size-[34rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--sidebar-primary)_32%,transparent),transparent)]" />
      <div className="absolute -bottom-48 -left-40 size-[38rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_30%,transparent),transparent)]" />
      <div className="bg-dots-sidebar absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
      <div className="bg-grain absolute inset-0 opacity-[0.07] mix-blend-overlay" />
    </div>
  )
}
