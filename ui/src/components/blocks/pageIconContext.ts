import type { LucideIcon } from 'lucide-react'
import { createContext, type ReactNode } from 'react'

/**
 * Icon of the current workspace route, provided by the shell from the
 * navigation map so every `PageHeader` shows the same pictogram as its
 * sidebar entry without each page wiring it.
 */
export const PageIconContext = createContext<LucideIcon | null>(null)

/**
 * Page-level tools provided by the shell for the current route (the GUIDE
 * button, later the favourite toggle). `PageHeader` renders them before its
 * own actions, so every page gets them without per-page wiring.
 */
export const PageToolsContext = createContext<ReactNode>(null)
