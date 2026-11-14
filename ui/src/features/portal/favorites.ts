import {
  allowsNavigation,
  navigationGroups,
  type NavigationItem,
  routePermissions,
} from '../../app/navigation'
import type { FunctionCode } from '../../lib/types'

/** localStorage key prefix of a user's favourites deck (`<prefix><userId>`). */
export const FAVORITES_KEY_PREFIX = 'agentra-favorites:'

/** Most functions the role defaults put on a new deck. */
export const DEFAULT_LIMIT = 8

type HasPermission = (permission: FunctionCode) => boolean

/**
 * Functions that may be favourites: every menu entry except the Portal itself
 * and entries that are not available yet (the AI assistant).
 */
export function favoritableItems(): NavigationItem[] {
  return navigationGroups
    .flatMap((group) => group.items)
    .filter((item) => item.path !== '/' && !item.unavailable)
}

export function isFavoritable(path: string): boolean {
  return favoritableItems().some((item) => item.path === path)
}

/** Whether the user may open this function (same rule as the route guard). */
export function isPermitted(path: string, hasPermission: HasPermission) {
  return allowsNavigation(hasPermission, routePermissions[path])
}

/**
 * Role defaults, derived from permissions (never from the group name): each
 * pair adds its path when the user holds the permission, in this order.
 * Accounting, warehouse, sales and administration duties come first; reports
 * and the dashboard follow for anyone who may read them.
 */
const DEFAULT_RULES: readonly (readonly [FunctionCode, string])[] = [
  ['cash.receipt.prepare', '/payment-receipts'],
  ['cash.receipt.post', '/payment-receipts'],
  ['cash.upfront.verify', '/upfront-payments'],
  ['stock.receipt.prepare', '/stock-receipts'],
  ['stock.issue.prepare', '/stock-issues'],
  ['stock.issue.post', '/stock-issues'],
  ['stock.count', '/stock-counts'],
  ['agency.manage', '/agencies'],
  ['debt.read', '/receivables'],
  ['inventory.read', '/inventory'],
  ['users.manage', '/users'],
  ['permissions.manage', '/permissions'],
  ['audit.read', '/audit-logs'],
  ['agency.read', '/agencies'],
  ['reports.read', '/reports'],
]

/** Starting deck for a user who never saved one. */
export function defaultFavorites(hasPermission: HasPermission): string[] {
  const allowed = (path: string) =>
    isFavoritable(path) && isPermitted(path, hasPermission)
  const picked: string[] = []
  for (const [permission, path] of DEFAULT_RULES) {
    if (picked.length >= DEFAULT_LIMIT) break
    if (hasPermission(permission) && allowed(path) && !picked.includes(path))
      picked.push(path)
  }
  if (picked.length > 0) return picked
  return favoritableItems()
    .map((item) => item.path)
    .filter(allowed)
    .slice(0, 4)
}

/**
 * Reads a stored deck: a JSON array of favouritable paths, kept in order and
 * de-duplicated. Anything else (missing, malformed, wrong type) is `null`.
 */
export function parseFavorites(raw: string | null): string[] | null {
  if (raw === null) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(value)) return null
  const paths: string[] = []
  for (const entry of value)
    if (
      typeof entry === 'string' &&
      isFavoritable(entry) &&
      !paths.includes(entry)
    )
      paths.push(entry)
  return paths
}

export function favoritesKey(userId: string): string {
  return FAVORITES_KEY_PREFIX + userId
}

/** Saved deck of a user, or `null` when none is saved or storage fails. */
export function readFavorites(userId: string): string[] | null {
  try {
    return parseFavorites(localStorage.getItem(favoritesKey(userId)))
  } catch {
    return null
  }
}

/** Saves a deck; returns false when storage refuses (the caller keeps it in memory). */
export function writeFavorites(userId: string, paths: readonly string[]) {
  try {
    localStorage.setItem(favoritesKey(userId), JSON.stringify(paths))
    return true
  } catch {
    return false
  }
}

export function addFavorite(list: readonly string[], path: string): string[] {
  return !isFavoritable(path) || list.includes(path)
    ? [...list]
    : [...list, path]
}

export function removeFavorite(list: readonly string[], path: string) {
  return list.filter((entry) => entry !== path)
}

/** Moves a path by `delta` places, clamped to the list; unknown paths are ignored. */
export function moveFavorite(
  list: readonly string[],
  path: string,
  delta: number,
): string[] {
  const from = list.indexOf(path)
  if (from < 0 || !Number.isFinite(delta)) return [...list]
  const to = Math.min(list.length - 1, Math.max(0, from + Math.trunc(delta)))
  const next = [...list]
  next.splice(from, 1)
  next.splice(to, 0, path)
  return next
}

/**
 * Applies a new order of the visible entries while keeping hidden
 * (no-longer-permitted) entries saved after them, so they come back if the
 * permission is granted again.
 */
export function reorderVisible(
  list: readonly string[],
  visibleOrder: readonly string[],
): string[] {
  const visible = visibleOrder.filter((path) => list.includes(path))
  return [...visible, ...list.filter((path) => !visible.includes(path))]
}

/** Splits a saved deck into the permitted entries and the hidden count. */
export function resolveDeck(
  list: readonly string[],
  hasPermission: HasPermission,
): { visible: string[]; hidden: number } {
  const visible = list.filter((path) => isPermitted(path, hasPermission))
  return { visible, hidden: list.length - visible.length }
}
