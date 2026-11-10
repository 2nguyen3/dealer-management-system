import type { ReactNode } from 'react'
import { IllustratedFigure } from '../../components/blocks/IllustratedFigure'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '../../components/shadcn/card'

export interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
}

/**
 * Split-screen frame for the public authentication pages: a quiet product
 * introduction (logo, one line, the animated supply-chain figure) beside the form.
 */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <aside
        aria-label="Giới thiệu Agentra"
        className="relative hidden overflow-hidden bg-linear-to-br from-[#e8efe6] via-[#eef2ec] to-[#f6f7f5] lg:flex lg:flex-col lg:p-10 xl:p-12"
      >
        <img
          className="relative h-14 w-auto self-start"
          src="/assets/brand/agentra-dark.png"
          alt="Agentra"
        />
        <div className="relative mt-10 max-w-lg space-y-3">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance text-primary xl:text-4xl">
            Từ nhà máy đến đại lý, trong một hệ thống.
          </h2>
          <p className="text-base text-muted-foreground">
            Agentra kết nối sản xuất, giao hàng và bán hàng của mạng lưới đại
            lý.
          </p>
        </div>
        <IllustratedFigure
          name="supplychain.html"
          title="Minh họa động: nhà máy sản xuất, xe giao hàng và đại lý nhận hàng, bán hàng"
          className="relative -mx-6 mt-6 min-h-80 flex-1"
        />
      </aside>
      <div className="flex min-w-0 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm space-y-6">
          <img
            className="mx-auto h-14 w-auto lg:hidden"
            src="/assets/brand/agentra-dark.png"
            alt="Agentra"
          />
          <Card className="gap-5 border-0 bg-transparent shadow-none sm:border sm:bg-card sm:shadow-xs">
            <CardHeader className="gap-1.5 px-0 sm:px-6">
              <h1 className="text-2xl leading-tight font-semibold tracking-tight">
                {title}
              </h1>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">{children}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
