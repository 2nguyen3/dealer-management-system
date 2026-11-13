import { Laptop, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuLabel,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { isPalette, PALETTES, usePalette } from './palette'

export const THEME_OPTIONS = [
  { value: 'light', label: 'Sáng', icon: Sun },
  { value: 'dark', label: 'Tối', icon: Moon },
  { value: 'system', label: 'Theo hệ thống', icon: Laptop },
] as const

/** shadcn "mode toggle": light / dark / system menu plus the colour palette. */
export function ModeToggle() {
  const { theme = 'system', setTheme } = useTheme()
  const [palette, setPalette] = usePalette()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Đổi giao diện và màu chủ đạo"
        >
          <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>Chế độ</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Màu chủ đạo</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={palette}
          onValueChange={(value) => isPalette(value) && setPalette(value)}
        >
          {PALETTES.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <span
                className="size-3.5 rounded-full ring-1 ring-black/10"
                style={{ background: option.swatch }}
                aria-hidden="true"
              />
              {option.label}
              <span className="ml-auto text-xs text-muted-foreground">
                {option.hint}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
