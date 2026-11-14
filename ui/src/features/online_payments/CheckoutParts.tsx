import { Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import QRCode from 'react-qr-code'
import { Button as ShadcnButton } from '@/components/shadcn/button'
import { t } from '@/lib/i18n/core'

/** QR of the validated https checkout URL; kept on white so it scans in dark mode. */
export function CheckoutQr({ url, size }: { url: string; size: number }) {
  return (
    <figure className="w-fit space-y-1.5">
      <div className="rounded-xl border bg-white p-3 shadow-xs">
        <QRCode
          value={url}
          size={size}
          level="M"
          title={t('Mã QR trang thanh toán VNPAY')}
        />
      </div>
      <figcaption className="text-center text-[0.7rem] text-muted-foreground">
        {t('Quét để mở VNPAY')}
      </figcaption>
    </figure>
  )
}

export function CheckoutLink({ url }: { url: string }) {
  return (
    <ShadcnButton asChild>
      <a href={url} target="_blank" rel="noreferrer">
        <ExternalLink className="size-4" aria-hidden="true" />
        {t('Mở trang thanh toán')}
      </a>
    </ShadcnButton>
  )
}

export function CheckoutActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <CheckoutLink url={url} />
      <ShadcnButton type="button" variant="outline" onClick={() => void copy()}>
        <Copy className="size-4" aria-hidden="true" />
        {copied ? t('Đã sao chép') : t('Sao chép liên kết')}
      </ShadcnButton>
    </div>
  )
}
