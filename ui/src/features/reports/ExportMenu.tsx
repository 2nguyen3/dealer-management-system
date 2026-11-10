import { ChevronDown, Download, FileText, Sheet } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import type { reportMedia } from './export'

export interface ExportMenuProps {
  /** Why export is unavailable; `null` enables the menu. */
  reason: string | null
  onExport: (format: keyof typeof reportMedia) => void
}

const HINT_ID = 'report-export-hint'

/** "Xuất báo cáo" menu exporting the full applied filter to PDF or XLSX. */
export function ExportMenu({ reason, onExport }: ExportMenuProps) {
  return (
    <div className="flex max-w-full flex-col items-stretch gap-1 sm:items-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!!reason}
            title={reason ?? 'Xuất toàn bộ kết quả đã lọc'}
            aria-describedby={reason ? HINT_ID : undefined}
          >
            <Download aria-hidden="true" />
            Xuất báo cáo
            <ChevronDown className="opacity-70" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Toàn bộ kết quả đã lọc
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            title="Xuất toàn bộ kết quả ra PDF"
            onSelect={() => onExport('pdf')}
          >
            <FileText aria-hidden="true" />
            Xuất PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            title="Xuất toàn bộ kết quả ra Excel"
            onSelect={() => onExport('xlsx')}
          >
            <Sheet aria-hidden="true" />
            Xuất XLSX
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {reason && (
        <p
          id={HINT_ID}
          className="max-w-72 text-xs text-muted-foreground sm:text-right"
        >
          {reason}
        </p>
      )}
    </div>
  )
}
