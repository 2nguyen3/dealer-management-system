import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { t } from '@/lib/i18n/core'
import { cn } from '@/lib/utils'
import { useFavorites } from './useFavorites'

/**
 * "Thêm vào yêu thích" star beside the GUIDE button. Renders nothing on pages
 * that cannot be favourites (the Portal, profile, AI assistant) or that the
 * user may not open.
 */
export function FavoriteButton({
  path,
  title,
}: {
  /** Route of the current page. */
  path: string
  /** Translated page title, used in the accessible name and the toast. */
  title: string
}) {
  const favorites = useFavorites()
  if (!favorites.canFavorite(path)) return null
  const active = favorites.isFavorite(path)
  return (
    <Button
      variant="outline"
      icon={
        <Star
          className={cn('size-4', active && 'fill-current text-amber-500')}
        />
      }
      aria-pressed={active}
      aria-label={
        active
          ? t('Bỏ {page} khỏi yêu thích', { page: title })
          : t('Thêm {page} vào yêu thích', { page: title })
      }
      data-testid="favorite-button"
      onClick={() => {
        favorites.toggle(path)
        toast.success(
          active
            ? t('Đã bỏ {page} khỏi yêu thích.', { page: title })
            : t('Đã thêm {page} vào yêu thích.', { page: title }),
        )
      }}
    >
      <span className="hidden sm:inline">
        {active ? t('Đã yêu thích') : t('Thêm vào yêu thích')}
      </span>
    </Button>
  )
}
