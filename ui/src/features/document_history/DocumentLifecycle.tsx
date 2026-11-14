import type { DocumentSummary } from './documentContracts'
import { lifecycleSteps } from './insightsModel'
import { LifecycleSteps } from './DocumentParts'

/** Draft → posted → cancelled/corrected, as a compact step rail. */
export function DocumentLifecycle({
  status,
  className,
}: {
  status: DocumentSummary['status']
  className?: string
}) {
  const { steps, current } = lifecycleSteps(status)
  return (
    <LifecycleSteps
      steps={steps}
      current={current}
      tone={
        status === 'CANCELLED'
          ? 'destructive'
          : status === 'POSTED'
            ? 'success'
            : 'primary'
      }
      className={className}
    />
  )
}
