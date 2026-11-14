import { allowsNavigation, routePermissions } from '../../app/navigation'
import { useAuth } from '../authentication/useAuth'

/** Returns a checker: may the current user open this route (path + query)? */
export function usePathAllowed(): (to: string) => boolean {
  const { hasPermission } = useAuth()
  return (to) => {
    const path = to.split(/[?#]/)[0] ?? to
    return allowsNavigation(hasPermission, routePermissions[path])
  }
}
