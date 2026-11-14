import { BookOpen } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { t } from '@/lib/i18n/core'

const GuideSheet = lazy(() =>
  import('./GuideSheet').then((module) => ({ default: module.GuideSheet })),
)

/**
 * "Hướng dẫn" button (book icon) that opens the route's guide in a side
 * sheet. The content chunk loads on first open. Collapses to the icon on
 * narrow screens while keeping its accessible name.
 */
export function GuideButton({
  path,
  title,
}: {
  /** Route whose guide to show. */
  path: string
  /** Translated page title shown in the sheet header. */
  title: string
}) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        icon={<BookOpen className="size-4" />}
        aria-label={t('Hướng dẫn: {page}', { page: title })}
        aria-haspopup="dialog"
        data-testid="guide-button"
        onClick={() => {
          setLoaded(true)
          setOpen(true)
        }}
      >
        <span className="hidden sm:inline">{t('Hướng dẫn')}</span>
      </Button>
      {loaded && (
        <Suspense fallback={null}>
          <GuideSheet
            path={path}
            title={title}
            open={open}
            onOpenChange={setOpen}
          />
        </Suspense>
      )}
    </>
  )
}
