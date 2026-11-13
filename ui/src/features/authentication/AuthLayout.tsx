import type { ReactNode } from 'react'
import { IllustratedFigure } from '../../components/blocks/IllustratedFigure'
import { BrandLogo } from '../../components/brand/BrandLogo'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '../../components/shadcn/card'
import { ModeToggle } from '../../components/theme/ModeToggle'

export interface AuthLayoutProps {
  title: string
  description: string
  /** Optional lucide icon shown in a tile beside the form title. */
  icon?: ReactNode
  children: ReactNode
}

/**
 * Split-screen frame for the public authentication pages: a quiet product
 * introduction (logo, one line, the animated supply-chain figure) beside the
 * form. Every colour comes from the theme tokens, so light/dark and each
 * palette stay coherent; the theme menu is available before signing in.
 */
export function AuthLayout({
  title,
  description,
  icon,
  children,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <aside
        aria-label="Giới thiệu Agentra"
        data-testid="auth-intro"
        className="relative hidden overflow-hidden border-r bg-linear-to-br from-primary/12 via-muted to-background lg:flex lg:flex-col lg:p-10 xl:p-12"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 size-[28rem] rounded-full bg-primary/10 blur-3xl"
        />
        <BrandLogo className="relative h-14 self-start" />
        <div className="relative mt-10 max-w-lg space-y-3">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance text-primary xl:text-4xl">
            Từ nhà máy đến đại lý, trong một hệ thống.
          </h2>
          <p className="text-base text-muted-foreground">
            Sản xuất, giao hàng và bán hàng của mạng lưới đại lý.
          </p>
        </div>
        <IllustratedFigure
          name="supplychain.html"
          title="Minh họa động: nhà máy sản xuất, xe giao hàng và đại lý nhận hàng, bán hàng"
          className="relative -mx-6 mt-6 min-h-80 flex-1"
        />
      </aside>
      <div className="relative flex min-w-0 items-center justify-center px-4 py-10 sm:px-8">
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
          <ModeToggle />
        </div>
        <div className="w-full max-w-sm space-y-6">
          <div className="flex justify-center lg:hidden">
            <BrandLogo className="h-14" />
          </div>
          <Card className="gap-5 border-0 bg-transparent shadow-none sm:border sm:bg-card sm:shadow-xs">
            <CardHeader className="flex flex-row items-center gap-3 px-0 sm:px-6">
              {icon && (
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15 [&_svg]:size-5"
                >
                  {icon}
                </span>
              )}
              <div className="min-w-0 space-y-1">
                <h1 className="text-2xl leading-tight font-semibold tracking-tight">
                  {title}
                </h1>
                <CardDescription>{description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">{children}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
