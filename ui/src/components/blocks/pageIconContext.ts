import type { LucideIcon } from 'lucide-react'
import { createContext } from 'react'

/**
 * Icon of the current workspace route, provided by the shell from the
 * navigation map so every `PageHeader` shows the same pictogram as its
 * sidebar entry without each page wiring it.
 */
export const PageIconContext = createContext<LucideIcon | null>(null)
