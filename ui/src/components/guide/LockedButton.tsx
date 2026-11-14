import { useId } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/shadcn/tooltip'
import { Button, type ButtonProps } from '@/components/ui/Button'

/**
 * A button that is disabled while `lockedReason` is set and explains why in a
 * tooltip (and to screen readers through `aria-describedby`). The server still
 * decides; the reason is the UI's prediction from the data it has.
 */
export function LockedButton({
  lockedReason,
  disabled,
  ...props
}: ButtonProps & { lockedReason?: string | null }) {
  const id = useId()
  if (!lockedReason) return <Button disabled={disabled} {...props} />
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Disabled buttons get no pointer/focus events; the wrapper carries them. */}
          <span
            tabIndex={0}
            className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-locked-reason={lockedReason}
          >
            <Button {...props} disabled aria-describedby={id} />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">{lockedReason}</TooltipContent>
      </Tooltip>
      <span id={id} className="sr-only">
        {lockedReason}
      </span>
    </TooltipProvider>
  )
}
