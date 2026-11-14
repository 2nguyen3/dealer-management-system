import {
  BookOpen,
  CircleAlert,
  Link2,
  ListChecks,
  Scale,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/shadcn/sheet'
import { WorkflowSteps } from '@/components/guide/WorkflowSteps'
import { describeError } from '@/lib/errors'
import { getLocale, t } from '@/lib/i18n/core'
import { localeDirection } from '@/lib/i18n/locales'
import { routeLabel } from '../../app/navigation'
import { guideFor } from './guides'

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground [&_svg]:size-4 [&_svg]:text-primary">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Side sheet with the route's guide: purpose, roles, flow, steps, rules, errors, links. */
export function GuideSheet({
  path,
  title,
  open,
  onOpenChange,
}: {
  path: string
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const guide = guideFor(path)
  const side = localeDirection(getLocale()) === 'rtl' ? 'left' : 'right'
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
        data-testid="guide-sheet"
      >
        <SheetHeader className="border-b pe-12">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-primary uppercase">
            <BookOpen className="size-3.5" aria-hidden="true" />
            {t('Hướng dẫn sử dụng')}
          </p>
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription>
            {guide ? t(guide.purpose) : t('Trang này chưa có hướng dẫn.')}
          </SheetDescription>
        </SheetHeader>
        {guide && (
          <div className="space-y-6 p-4 text-sm leading-relaxed">
            <Section icon={<Target />} title={t('Trang này để làm gì')}>
              <p className="text-muted-foreground">{t(guide.purpose)}</p>
            </Section>
            <Section icon={<Users />} title={t('Ai làm')}>
              <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
                {guide.roles.map((role) => (
                  <li key={role}>{t(role)}</li>
                ))}
              </ul>
            </Section>
            {guide.flow && guide.flow.length > 0 && (
              <Section icon={<Sparkles />} title={t('Sơ đồ các bước')}>
                <WorkflowSteps
                  label={t('Sơ đồ các bước')}
                  steps={guide.flow.map((step, index) => ({
                    key: `${index}`,
                    label: t(step.label),
                    ...(step.role ? { role: t(step.role) } : {}),
                    state: 'todo',
                  }))}
                />
              </Section>
            )}
            <Section icon={<ListChecks />} title={t('Từng bước chi tiết')}>
              <ol className="list-decimal space-y-1.5 ps-5 text-muted-foreground">
                {guide.steps.map((step) => (
                  <li key={step}>{t(step)}</li>
                ))}
              </ol>
            </Section>
            {guide.rules && guide.rules.length > 0 && (
              <Section
                icon={<Scale />}
                title={t('Quy định nghiệp vụ liên quan')}
              >
                <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
                  {guide.rules.map((rule) => (
                    <li key={rule}>{t(rule)}</li>
                  ))}
                </ul>
              </Section>
            )}
            {guide.tips && guide.tips.length > 0 && (
              <Section icon={<Sparkles />} title={t('Mẹo')}>
                <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
                  {guide.tips.map((tip) => (
                    <li key={tip}>{t(tip)}</li>
                  ))}
                </ul>
              </Section>
            )}
            {guide.errors && guide.errors.length > 0 && (
              <Section
                icon={<CircleAlert />}
                title={t('Lỗi thường gặp & cách xử lý')}
              >
                <dl className="space-y-2">
                  {guide.errors.map((code) => {
                    const text = describeError(code)
                    if (!text) return null
                    return (
                      <div
                        key={code}
                        className="rounded-lg border bg-muted/40 p-2.5"
                      >
                        <dt className="font-medium text-foreground">
                          {text.message}
                        </dt>
                        {text.hint && (
                          <dd className="text-[13px] text-muted-foreground">
                            {text.hint}
                          </dd>
                        )}
                        <dd className="mt-1 font-mono text-[11px] text-muted-foreground/80">
                          {code}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              </Section>
            )}
            {guide.related && guide.related.length > 0 && (
              <Section icon={<Link2 />} title={t('Liên kết trang liên quan')}>
                <ul className="flex flex-wrap gap-2">
                  {guide.related.map((related) => (
                    <li key={related}>
                      <Link
                        to={related}
                        onClick={() => onOpenChange(false)}
                        className="inline-flex rounded-md border px-2.5 py-1 text-[13px] font-medium text-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {routeLabel(related)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
