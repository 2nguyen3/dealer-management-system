import type { DocumentKind, DocumentSummary } from './documentContracts'
import { lifecycleSteps } from './insightsModel'
import { LifecycleSteps } from './DocumentParts'

/** Draft → (pending) → posted → corrected/cancelled, as a compact step rail. */
export function DocumentLifecycle({
  kind,
  status,
  className,
}: {
  kind: DocumentKind
  status: DocumentSummary['status']
  className?: string
}) {
  const { steps, current } = lifecycleSteps(kind, status)
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
