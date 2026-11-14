import { adminGuides } from './content/admin'
import { goodsGuides } from './content/goods'
import { masterGuides } from './content/master'
import { moneyGuides } from './content/money'
import { overviewGuides } from './content/overview'
import type { GuideContent } from './types'

/** Every guide, one per route; loaded lazily with the guide sheet. */
export const GUIDES: ReadonlyMap<string, GuideContent> = new Map(
  [
    ...overviewGuides,
    ...masterGuides,
    ...goodsGuides,
    ...moneyGuides,
    ...adminGuides,
  ].map((guide) => [guide.path, guide]),
)

/** Guide of a route (exact path, else the longest matching parent). */
export function guideFor(path: string): GuideContent | null {
  const exact = GUIDES.get(path)
  if (exact) return exact
  const parent = [...GUIDES.keys()]
    .filter((key) => key !== '/' && path.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0]
  return parent ? (GUIDES.get(parent) ?? null) : null
}
