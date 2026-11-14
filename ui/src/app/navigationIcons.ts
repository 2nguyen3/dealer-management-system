import {
  Bot,
  ChartColumn,
  Globe,
  History,
  House,
  LayoutDashboard,
  Library,
  Package,
  PackageMinus,
  PackagePlus,
  Receipt,
  Ruler,
  Scale,
  ScrollText,
  ShieldCheck,
  Store,
  Tags,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { NavigationSectionKey } from './navigation'

/** Sidebar icon for each workspace route. */
export const navigationIcons: Record<string, LucideIcon> = {
  '/': House,
  '/dashboard': LayoutDashboard,
  '/reports': ChartColumn,
  '/agencies': Store,
  '/products': Package,
  '/stock-receipts': PackagePlus,
  '/stock-issues': PackageMinus,
  '/payment-receipts': Receipt,
  '/online-payments': Globe,
  '/agency-types': Tags,
  '/units': Ruler,
  '/business-rules': Scale,
  '/users': Users,
  '/user-groups': UsersRound,
  '/permissions': ShieldCheck,
  '/audit-logs': ScrollText,
  '/document-history': History,
  '/chatbot': Bot,
}

/** Sidebar icon of each merged entry (its pages keep their own icons). */
export const sectionIcons: Record<NavigationSectionKey, LucideIcon> = {
  catalogue: Library,
  access: UserCog,
}
