import { Check, ChevronsUpDown, Languages } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/shadcn/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/shadcn/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/shadcn/popover'
import { t } from '@/lib/i18n/core'
import { localeInfo, LOCALES } from '@/lib/i18n/locales'
import { availableLocales, changeLocale, useLocale } from '@/lib/i18n/runtime'
import { cn } from '@/lib/utils'

/**
 * Searchable interface-language picker (native name first, English name
 * second). Choosing a language saves it and reloads the page so every text,
 * including menus built at start-up, appears in that language.
 */
export function LanguagePicker({
  compact = false,
  className,
  onChange = changeLocale,
}: {
  /** Icon-and-code trigger for tight places such as the login screen. */
  compact?: boolean
  className?: string
  /** Applies the choice (tests inject a stub). */
  onChange?: (code: string) => unknown
}) {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const available = new Set(availableLocales())
  const options = LOCALES.filter((option) => available.has(option.code))
  const current = localeInfo(locale) ?? LOCALES[0]!
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t('Ngôn ngữ giao diện: {language}', {
            language: current.nativeName,
          })}
          data-testid="language-picker"
          className={cn(
            compact ? 'h-9 gap-1.5 px-2.5' : 'w-full justify-between sm:w-72',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Languages className="size-4 shrink-0" aria-hidden="true" />
            {compact ? (
              <span className="text-xs font-semibold uppercase">
                {current.code}
              </span>
            ) : (
              <span className="truncate">{current.nativeName}</span>
            )}
          </span>
          {!compact && (
            <ChevronsUpDown
              className="size-4 shrink-0 opacity-50"
              aria-hidden="true"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder={t('Tìm ngôn ngữ…')} />
          <CommandList>
            <CommandEmpty>{t('Không tìm thấy ngôn ngữ.')}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.code}
                value={`${option.nativeName} ${option.englishName} ${option.code}`}
                lang={option.code}
                dir={option.dir}
                onSelect={() => {
                  setOpen(false)
                  if (option.code !== locale) void onChange(option.code)
                }}
              >
                <span className="min-w-0 flex-1 truncate">
                  {option.nativeName}
                </span>
                <span
                  className="text-xs text-muted-foreground"
                  lang="en"
                  dir="ltr"
                >
                  {option.englishName}
                </span>
                <Check
                  aria-hidden="true"
                  className={cn(
                    'size-4',
                    option.code === locale ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
