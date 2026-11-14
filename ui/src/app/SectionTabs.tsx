import { NavLink } from 'react-router'
import { useAuth } from '../features/authentication/useAuth'
import {
  allowsNavigation,
  routeLabel,
  routePermissions,
  sectionOf,
} from './navigation'
import { navigationIcons } from './navigationIcons'
import { cn } from '@/lib/utils'

/**
 * Horizontal sub-tabs of a merged sidebar entry. Each tab is a route link, so
 * the address, browser history and per-route permissions keep working; tabs the
 * user cannot open are hidden and a single remaining tab hides the bar.
 */
export function SectionTabs({ pathname }: { pathname: string }) {
  const { hasPermission } = useAuth()
  const section = sectionOf(pathname)
  if (!section) return null
  const paths = section.paths.filter((path) =>
    allowsNavigation(hasPermission, routePermissions[path]),
  )
  if (paths.length < 2) return null

  return (
    <nav
      aria-label={section.label}
      data-testid="section-tabs"
      className="-mt-1 mb-5 overflow-x-auto border-b"
    >
      <ul className="flex min-w-max items-end gap-1">
        {paths.map((path) => {
          const Icon = navigationIcons[path]
          return (
            <li key={path}>
              <NavLink
                to={path}
                end
                className={({ isActive }) =>
                  cn(
                    '-mb-px inline-flex h-10 items-center gap-2 rounded-t-md border-b-2 px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    isActive
                      ? 'border-primary font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                  )
                }
              >
                {Icon && <Icon className="size-4" aria-hidden="true" />}
                {routeLabel(path)}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
