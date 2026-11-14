import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useAuth } from '../authentication/useAuth'
import {
  addFavorite,
  defaultFavorites,
  isFavoritable,
  isPermitted,
  moveFavorite,
  readFavorites,
  removeFavorite,
  reorderVisible,
  resolveDeck,
  writeFavorites,
} from './favorites'

/**
 * Saved decks per user for this tab. A deck read once from storage stays
 * here, so a failed write still keeps the change for the session. `null`
 * means "never saved": the role defaults apply.
 */
const decks = new Map<string, string[] | null>()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of [...listeners]) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith('agentra-favorites:')) {
      decks.clear()
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Saved deck of a user (storage is read once per session and user). */
export function savedDeck(userId: string): string[] | null {
  if (!decks.has(userId)) decks.set(userId, readFavorites(userId))
  return decks.get(userId) ?? null
}

/** Replaces a user's deck in memory and storage; notifies every view. */
export function saveDeck(userId: string, paths: string[] | null): void {
  decks.set(userId, paths)
  if (paths) writeFavorites(userId, paths)
  else
    try {
      localStorage.removeItem(`agentra-favorites:${userId}`)
    } catch {
      // The in-memory reset still applies for this tab.
    }
  emit()
}

/** Test helper: forget every cached deck. */
export function resetFavoritesForTests(): void {
  decks.clear()
}

export interface FavoritesApi {
  /** Permitted favourites in deck order. */
  favorites: string[]
  /** Saved favourites hidden because the permission was removed. */
  hidden: number
  /** True when the user never saved a deck (role defaults are shown). */
  usingDefaults: boolean
  isFavorite: (path: string) => boolean
  /** Whether this page may be added (favouritable and permitted). */
  canFavorite: (path: string) => boolean
  add: (path: string) => void
  remove: (path: string) => void
  toggle: (path: string) => void
  move: (path: string, delta: number) => void
  /** New order of the visible favourites (drag and drop). */
  reorder: (visibleOrder: string[]) => void
  restoreDefaults: () => void
}

/** The signed-in user's favourites deck. Without a user nothing is saved. */
export function useFavorites(): FavoritesApi {
  const { user, hasPermission } = useAuth()
  const userId = user?.id ?? ''
  const saved = useSyncExternalStore(
    subscribe,
    () => (userId ? savedDeck(userId) : null),
    () => null,
  )
  const defaults = useMemo(
    () => defaultFavorites(hasPermission),
    [hasPermission],
  )
  const list = saved ?? defaults
  const { visible, hidden } = resolveDeck(list, hasPermission)

  const update = useCallback(
    (change: (current: string[]) => string[]) => {
      if (!userId) return
      saveDeck(userId, change(savedDeck(userId) ?? defaults))
    },
    [userId, defaults],
  )

  const canFavorite = (path: string) =>
    Boolean(userId) && isFavoritable(path) && isPermitted(path, hasPermission)

  return {
    favorites: visible,
    hidden,
    usingDefaults: saved === null,
    isFavorite: (path) => visible.includes(path),
    canFavorite,
    add: (path) => {
      if (canFavorite(path)) update((current) => addFavorite(current, path))
    },
    remove: (path) => update((current) => removeFavorite(current, path)),
    toggle: (path) => {
      if (visible.includes(path))
        update((current) => removeFavorite(current, path))
      else if (canFavorite(path))
        update((current) => addFavorite(current, path))
    },
    move: (path, delta) => {
      // Moves are relative to the visible order; hidden entries stay last.
      const order = moveFavorite(visible, path, delta)
      update((current) => reorderVisible(current, order))
    },
    reorder: (visibleOrder) =>
      update((current) => reorderVisible(current, visibleOrder)),
    restoreDefaults: () => {
      if (userId) saveDeck(userId, null)
    },
  }
}
