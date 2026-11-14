import type { LucideIcon } from 'lucide-react'
import type { FunctionCode } from '../lib/types'
import {
  allowsNavigation,
  navigationGroups,
  routePermissions,
  sectionOf,
  type NavigationGroupKey,
} from './navigation'
import { navigationIcons, sectionIcons } from './navigationIcons'

export interface SidebarEntry {
  /** Link target: the route, or the first allowed page of a merged section. */
  path: string
  label: string
  icon?: LucideIcon
  /** Routes that highlight this entry. */
  paths: readonly string[]
  unavailable?: boolean
}

/**
 * Sidebar entries of the allowed menu: pages of a merged section collapse into
 * one entry (opening its first allowed page); the search also matches the
 * names of the pages behind a merged entry.
 */
export function sidebarGroups(
  hasPermission: (permission: FunctionCode) => boolean,
  search = '',
): { key: NavigationGroupKey; title: string; entries: SidebarEntry[] }[] {
  return navigationGroups
    .map((group) => {
      const entries: SidebarEntry[] = []
      const seen = new Set<string>()
      for (const item of group.items) {
        if (!allowsNavigation(hasPermission, routePermissions[item.path]))
          continue
        const section = sectionOf(item.path)
        if (section) {
          if (seen.has(section.key)) continue
          seen.add(section.key)
          const allowed = group.items.filter(
            (other) =>
              section.paths.includes(other.path) &&
              allowsNavigation(hasPermission, routePermissions[other.path]),
          )
          const haystack = [group.title, section.label]
            .concat(allowed.map((other) => other.label))
            .join(' ')
          if (search && !haystack.toLocaleLowerCase('vi').includes(search))
            continue
          entries.push({
            path: item.path,
            label: section.label,
            icon: sectionIcons[section.key],
            paths: section.paths,
          })
          continue
        }
        if (
          search &&
          !`${group.title} ${item.label}`
            .toLocaleLowerCase('vi')
            .includes(search)
        )
          continue
        entries.push({
          path: item.path,
          label: item.label,
          icon: navigationIcons[item.path],
          paths: [item.path],
          unavailable: item.unavailable,
        })
      }
      return { key: group.key, title: group.title, entries }
    })
    .filter((group) => group.entries.length > 0)
}
