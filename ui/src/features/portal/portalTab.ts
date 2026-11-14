/** Portal tabs. */
export type PortalTab = 'favorites' | 'functions'

/** localStorage key prefix of the open Portal tab (`<prefix><userId>`). */
export const PORTAL_TAB_KEY_PREFIX = 'agentra-portal-tab:'

export function isPortalTab(value: unknown): value is PortalTab {
  return value === 'favorites' || value === 'functions'
}

/** Remembered tab of a user, or `null` (none, unknown value, storage error). */
export function readPortalTab(userId: string): PortalTab | null {
  if (!userId) return null
  try {
    const value = localStorage.getItem(PORTAL_TAB_KEY_PREFIX + userId)
    return isPortalTab(value) ? value : null
  } catch {
    return null
  }
}

/** Remembers the open tab; returns false when storage refuses. */
export function writePortalTab(userId: string, tab: PortalTab): boolean {
  if (!userId) return false
  try {
    localStorage.setItem(PORTAL_TAB_KEY_PREFIX + userId, tab)
    return true
  } catch {
    return false
  }
}
