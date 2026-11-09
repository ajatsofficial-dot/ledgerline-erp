'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLink({ href, exact = false, badge, children }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + '/');
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}>
      {children}
      {badge ? <span className="count" title="Confirmed orders waiting to ship">{badge}</span> : null}
    </Link>
  );
}
