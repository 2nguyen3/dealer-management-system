import { Ban, Check, CircleDashed, Lock } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/shadcn/tooltip'
import { t } from '@/lib/i18n/core'
import { cn } from '@/lib/utils'
import { STEP_STATE_TEXT, type StepState, type WorkflowStep } from './steps'

export type { StepState, WorkflowStep } from './steps'

const DOT: Record<StepState, string> = {
  done: 'border-success/40 bg-success/15 text-success',
  current: 'border-primary bg-primary text-primary-foreground',
  blocked: 'border-warning/60 bg-warning/15 text-warning',
  todo: 'border-border bg-muted text-muted-foreground',
  skipped: 'border-dashed border-border text-muted-foreground',
}

function StepMark({ state, index }: { state: StepState; index: number }) {
  if (state === 'done') return <Check />
  if (state === 'blocked') return <Lock />
  if (state === 'skipped') return <CircleDashed />
  return (
    <span className="text-[11px] font-semibold tabular-nums">{index + 1}</span>
  )
}

/**
 * Compact horizontal process rail. Every step is focusable and has a tooltip
 * with its role and hint; the state is written as text, never colour only.
 */
export function WorkflowSteps({
  steps,
  label,
  className,
}: {
  steps: readonly WorkflowStep[]
  /** Translated accessible name, e.g. "Quy trình phiếu xuất". */
  label: string
  className?: string
}) {
  if (!steps.length) return null
  return (
    <TooltipProvider delayDuration={150}>
      <nav aria-label={label} className={cn('min-w-0', className)}>
        <ol
          className="flex flex-wrap items-stretch gap-x-1 gap-y-2"
          data-testid="workflow-steps"
        >
          {steps.map((step, index) => {
            const stateText = t(STEP_STATE_TEXT[step.state])
            return (
              <li
                key={step.key}
                className="flex min-w-0 items-center gap-1"
                data-state={step.state}
                aria-current={step.state === 'current' ? 'step' : undefined}
              >
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-px w-3 shrink-0 sm:w-5',
                      step.state === 'todo' || step.state === 'skipped'
                        ? 'bg-border'
                        : 'bg-primary/40',
                    )}
                  />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className={cn(
                        'flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        step.state === 'current' &&
                          'border-primary/50 bg-primary/5',
                        step.state === 'blocked' &&
                          'border-warning/50 bg-warning/5',
                        step.state === 'skipped' && 'border-dashed opacity-70',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-full border [&_svg]:size-3.5',
                          DOT[step.state],
                        )}
                      >
                        {step.state === 'skipped' ? (
                          <Ban />
                        ) : (
                          <StepMark state={step.state} index={index} />
                        )}
                      </span>
                      <span className="grid min-w-0 leading-tight">
                        <span className="truncate text-xs font-medium text-foreground">
                          {step.label}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {stateText}
                          {step.role ? ` · ${step.role}` : ''}
                        </span>
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72 text-start">
                    <p className="font-semibold">{step.label}</p>
                    {step.role && (
                      <p>{t('Người thực hiện: {role}', { role: step.role })}</p>
                    )}
                    <p>{stateText}</p>
                    {step.hint && <p className="mt-1">{step.hint}</p>}
                  </TooltipContent>
                </Tooltip>
              </li>
            )
          })}
        </ol>
      </nav>
    </TooltipProvider>
  )
}
