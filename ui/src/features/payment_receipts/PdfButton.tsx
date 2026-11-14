import { FileDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button, type ButtonProps } from '../../components/ui/Button'
import { apiDownload } from '../../lib/api'
import { errorMessage } from '../document_history/useDocumentRequests'
import { t } from '../../lib/i18n/core'

/** Saves a server-rendered PDF (print endpoint) under ``filename``. */
async function downloadPdf(
  path: string,
  filename: string,
  signal?: AbortSignal,
): Promise<void> {
  const result = await apiDownload(path, {
    headers: { Accept: 'application/pdf' },
    signal,
  })
  if (signal?.aborted) return
  const url = URL.createObjectURL(result.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.click()
  // Give the browser time to start consuming the blob before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Button that downloads the PDF of ``path`` (``/documents/{id}/print``,
 * ``/online-payments/{id}/print``). A failure is shown as an error toast; the
 * request is aborted when the button unmounts.
 */
export function PdfButton({
  path,
  filename,
  children,
  variant = 'outline',
  ...props
}: {
  path: string
  filename: string
} & Omit<ButtonProps, 'onClick' | 'isLoading'>) {
  const [busy, setBusy] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])

  async function run() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    try {
      await downloadPdf(path, filename, controller.signal)
    } catch (failure) {
      if (!controller.signal.aborted)
        toast.error(t('Không xuất được PDF.'), {
          description: errorMessage(failure),
        })
    } finally {
      if (active.current === controller) {
        active.current = null
        setBusy(false)
      }
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      icon={<FileDown className="size-4" />}
      isLoading={busy}
      onClick={() => void run()}
      {...props}
    >
      {children ?? t('Xuất PDF')}
    </Button>
  )
}
