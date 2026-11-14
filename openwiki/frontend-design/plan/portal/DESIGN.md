# Portal — design

## Data

`favorites.ts` (pure): `favoritableItems()` lists navigation items except `/` and `unavailable`
entries; `isFavoritable(path)`; `defaultFavorites(hasPermission)` walks a fixed priority list of
`[permission, path]` pairs (accounting, warehouse, sales, administration) and keeps permitted
paths (at most 8; falls back to the first permitted functions); `parseFavorites(raw)` accepts
only a JSON array of known favouritable paths, de-duplicated (anything else → `null`);
`readFavorites/writeFavorites(userId)` wrap storage in `try/catch`; `addFavorite`,
`removeFavorite`, `moveFavorite` return new arrays; `resolveDeck(saved, allowed)` splits the
saved list into visible paths and a hidden count.

`favoritesStore.ts`: an in-memory map per user with subscribers (`useSyncExternalStore`), filled
from storage on first read and written through on every change. `useFavorites()` exposes the
visible deck, hidden count, `isFavorite`, `canFavorite`, `toggle`, `add`, `remove`, `move`,
`reorder` and `restoreDefaults`. A user who never saved a deck sees the role defaults; an
explicitly emptied deck stays empty until restored.

## UI

- `FavoriteButton` (star, `aria-pressed`) renders in `PageToolsContext` beside GUIDE only when
  the page is favouritable and permitted; a toast confirms the change.
- `FavoritesDeck`: `Reorder.Group` of cards (icon from `navigationIcons`, name, short
  description, open link), each with move up/down and remove buttons; "Thêm chức năng" picker
  (Popover + Command) listing permitted, not yet added functions; "Khôi phục mặc định".
- `HomePage`: header unchanged except the title; `Tabs` with `favorites` and `functions`; the
  catalogue cards gain a star toggle placed outside the card link.
- `portalTab.ts`: `readPortalTab/writePortalTab(userId)` with the same storage guards.
