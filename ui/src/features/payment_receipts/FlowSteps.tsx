import { Check, CircleDashed, TimerOff, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Stagger, StaggerItem } from '@/components/motion/Motion'
import { Badge } from '@/components/shadcn/badge'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/shadcn/item'
import { Progress } from '@/components/shadcn/progress'
import { cn } from '@/lib/utils'
import {
  flowOutcome,
  flowProgress,
  type FlowOutcome,
  type FlowState,
  type FlowStep,
} from './flow'

const STATE_TEXT: Record<FlowState, string> = {
  done: 'Xong',
  current: 'Đang ở bước này',
  upcoming: 'Tiếp theo',
  failed: 'Dừng tại đây',
  expired: 'Quá hạn',
  skipped: 'Bỏ qua',
}

const MEDIA: Record<FlowState, string> = {
  done: 'border-success/30 bg-success/12 text-success',
  current: 'border-primary/40 bg-primary/12 text-primary',
  upcoming: 'border-border bg-muted text-muted-foreground',
  failed: 'border-destructive/30 bg-destructive/12 text-destructive',
  expired: 'border-warning/30 bg-warning/12 text-warning',
  skipped: 'border-dashed border-border bg-transparent text-muted-foreground',
}

const ITEM: Record<FlowState, string> = {
  done: 'border-success/25',
  current: 'border-primary/50 bg-primary/5 shadow-xs',
  upcoming: 'border-border',
  failed: 'border-destructive/40 bg-destructive/5',
  expired: 'border-warning/40 bg-warning/5',
  skipped: 'border-dashed border-border opacity-60',
}

const OUTCOME: Record<
  FlowOutcome,
  { text: string; tone: string; bar: string }
> = {
  active: {
    text: 'Đang diễn ra',
    tone: 'border-primary/30 bg-primary/10 text-primary',
    bar: '[&_[data-slot=progress-indicator]]:bg-primary',
  },
  complete: {
    text: 'Hoàn thành',
    tone: 'border-success/30 bg-success/10 text-success',
    bar: '[&_[data-slot=progress-indicator]]:bg-success',
  },
  failed: {
    text: 'Đã dừng',
    tone: 'border-destructive/30 bg-destructive/10 text-destructive',
    bar: '[&_[data-slot=progress-indicator]]:bg-destructive',
  },
  expired: {
    text: 'Đã quá hạn',
    tone: 'border-warning/30 bg-warning/10 text-warning',
    bar: '[&_[data-slot=progress-indicator]]:bg-warning',
  },
}

function StepIcon({ state, index }: { state: FlowState; index: number }) {
  if (state === 'done') return <Check />
  if (state === 'failed') return <X />
  if (state === 'expired') return <TimerOff />
  if (state === 'skipped') return <CircleDashed />
  return <span className="text-xs font-semibold tabular-nums">{index + 1}</span>
}

/**
 * Lifecycle tracker: overall progress bar + one shadcn Item per step. The
 * current step pulses; failed/expired steps are drawn as a terminal branch.
 * Every state is also written as text for screen readers and colour-blind use.
 */
export function FlowSteps({
  steps,
  label,
  className,
}: {
  steps: readonly FlowStep[]
  label: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const outcome = OUTCOME[flowOutcome(steps)]
  const progress = flowProgress(steps)
  return (
    <section
      aria-label={label}
      className={cn('space-y-3 rounded-xl border bg-card p-3', className)}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <Progress
          value={progress}
          aria-label={`${label}: ${progress}%`}
          className={cn('h-1.5 flex-1 bg-muted', outcome.bar)}
        />
        <Badge variant="outline" className={outcome.tone}>
          {outcome.text}
        </Badge>
      </div>
      <Stagger step={0.06}>
        <ol
          className={cn(
            'grid gap-2',
            steps.length >= 4
              ? 'sm:grid-cols-2 lg:grid-cols-4'
              : 'sm:grid-cols-3',
          )}
        >
          {steps.map((step, index) => (
            <li
              key={step.key}
              aria-current={step.state === 'current' ? 'step' : undefined}
              data-state={step.state}
              className="min-w-0"
            >
              <StaggerItem className="h-full">
                <Item
                  variant="outline"
                  size="sm"
                  className={cn('h-full flex-nowrap px-3', ITEM[step.state])}
                >
                  <ItemMedia
                    variant="icon"
                    className={cn(
                      'relative size-8 rounded-full',
                      MEDIA[step.state],
                    )}
                  >
                    {step.state === 'current' && !reduce && (
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full border-2 border-primary/50"
                        animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
                        transition={{
                          duration: 1.6,
                          repeat: Infinity,
                          ease: 'easeOut',
                        }}
                      />
                    )}
                    <StepIcon state={step.state} index={index} />
                  </ItemMedia>
                  <ItemContent className="min-w-0 gap-0.5">
                    <ItemTitle className="text-[0.8rem] leading-tight">
                      {step.label}
                    </ItemTitle>
                    <ItemDescription className="truncate text-[0.7rem]">
                      {step.hint ?? STATE_TEXT[step.state]}
                      {step.hint && (
                        <span className="sr-only">
                          {' '}
                          ({STATE_TEXT[step.state]})
                        </span>
                      )}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              </StaggerItem>
            </li>
          ))}
        </ol>
      </Stagger>
    </section>
  )
}
