import {
  ArrowDown,
  ArrowUp,
  FileText,
  GripVertical,
  Plus,
  RotateCcw,
  Star,
  X,
} from 'lucide-react'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { routeLabel } from '../../app/navigation'
import { navigationIcons } from '../../app/navigationIcons'
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
import { EmptyState } from '@/components/ui/EmptyState'
import { t } from '@/lib/i18n/core'
import { areaOf, DESCRIPTIONS } from './catalogue'
import { favoritableItems } from './favorites'
import type { FavoritesApi } from './useFavorites'

/**
 * The favourites deck: open, reorder (drag handle or the up/down buttons for
 * keyboard users), remove, add from a searchable picker and restore the role
 * defaults. Entries the user may no longer open are hidden with a note.
 */
export function FavoritesDeck({ favorites }: { favorites: FavoritesApi }) {
  const candidates = favoritableItems().filter(
    (item) =>
      favorites.canFavorite(item.path) && !favorites.isFavorite(item.path),
  )
  const restore = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={favorites.usingDefaults}
      onClick={favorites.restoreDefaults}
      data-testid="favorites-restore"
    >
      <RotateCcw aria-hidden="true" />
      {t('Khôi phục mặc định')}
    </Button>
  )
  return (
    <section className="space-y-4" aria-labelledby="favorites-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="favorites-title" className="text-lg font-semibold">
          {t('Chức năng yêu thích')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <AddFavoritePicker
            candidates={candidates.map((item) => item.path)}
            onAdd={favorites.add}
          />
          {restore}
        </div>
      </div>
      {favorites.hidden > 0 && (
        <p
          className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground"
          data-testid="favorites-hidden"
        >
          {t(
            '{count} chức năng yêu thích không còn quyền truy cập nên đã được ẩn.',
            { count: favorites.hidden },
          )}
        </p>
      )}
      {favorites.favorites.length === 0 ? (
        <EmptyState
          icon={<Star className="size-6" />}
          title={t('Chưa có chức năng yêu thích')}
          description={t(
            'Bấm ngôi sao trên thẻ ở tab Chức năng nghiệp vụ, nút Thêm vào yêu thích cạnh Hướng dẫn trên mỗi trang, hoặc nút Thêm chức năng.',
          )}
        />
      ) : (
        <Reorder.Group
          as="ol"
          axis="y"
          values={favorites.favorites}
          onReorder={favorites.reorder}
          className="grid gap-2"
          aria-label={t('Chức năng yêu thích')}
        >
          {favorites.favorites.map((path, index) => (
            <FavoriteRow
              key={path}
              path={path}
              first={index === 0}
              last={index === favorites.favorites.length - 1}
              favorites={favorites}
            />
          ))}
        </Reorder.Group>
      )}
    </section>
  )
}

function FavoriteRow({
  path,
  first,
  last,
  favorites,
}: {
  path: string
  first: boolean
  last: boolean
  favorites: FavoritesApi
}) {
  const controls = useDragControls()
  const reduce = useReducedMotion()
  const label = routeLabel(path)
  const area = areaOf(path)
  const Icon = navigationIcons[path] ?? FileText
  return (
    <Reorder.Item
      value={path}
      dragListener={false}
      dragControls={controls}
      layout={reduce ? undefined : 'position'}
      className="flex items-center gap-2 rounded-xl border bg-card p-2 shadow-xs"
      data-testid="favorite-row"
    >
      <button
        type="button"
        className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-hidden="true"
        tabIndex={-1}
        onPointerDown={(event) => controls.start(event)}
      >
        <GripVertical className="size-4" />
      </button>
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: `color-mix(in oklab, ${area.color} 14%, transparent)`,
          color: area.color,
        }}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <Link
        to={path}
        className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block truncate font-medium">{label}</span>
        {DESCRIPTIONS[path] && (
          <span className="block truncate text-xs text-muted-foreground">
            {DESCRIPTIONS[path]}
          </span>
        )}
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={first}
          aria-label={t('Đưa {page} lên', { page: label })}
          onClick={() => favorites.move(path, -1)}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={last}
          aria-label={t('Đưa {page} xuống', { page: label })}
          onClick={() => favorites.move(path, 1)}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('Bỏ {page} khỏi yêu thích', { page: label })}
          onClick={() => favorites.remove(path)}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </Reorder.Item>
  )
}

/** Searchable list of permitted functions that are not favourites yet. */
function AddFavoritePicker({
  candidates,
  onAdd,
}: {
  candidates: string[]
  onAdd: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          disabled={candidates.length === 0}
          data-testid="favorites-add"
        >
          <Plus aria-hidden="true" />
          {t('Thêm chức năng')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder={t('Tìm chức năng…')} />
          <CommandList>
            <CommandEmpty>{t('Không tìm thấy chức năng.')}</CommandEmpty>
            {candidates.map((path) => {
              const Icon = navigationIcons[path] ?? FileText
              return (
                <CommandItem
                  key={path}
                  value={`${routeLabel(path)} ${path}`}
                  onSelect={() => {
                    onAdd(path)
                    setOpen(false)
                  }}
                >
                  <Icon aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    {routeLabel(path)}
                  </span>
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
