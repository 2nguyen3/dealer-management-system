import type { AnchorHTMLAttributes } from 'react'
import { Link, useInRouterContext } from 'react-router'

/**
 * Client-side link inside a router, plain anchor outside one (isolated page
 * renders), so guidance components never require router context.
 */
export function SafeLink({
  to,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string }) {
  const inRouter = useInRouterContext()
  return inRouter ? <Link to={to} {...props} /> : <a href={to} {...props} />
}
