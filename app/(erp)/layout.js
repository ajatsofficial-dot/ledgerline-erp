import { requireUser } from '@/lib/auth';
import { can, ROLES } from '@/lib/permissions';
import { getSettings, listSales } from '@/lib/queries';
import { logout } from '../actions';
import { BrandMark } from '../ui';
import NavLink from './NavLink';

export const dynamic = 'force-dynamic';

export default async function ErpLayout({ children }) {
  const user = await requireUser();
  const [settings, toShip] = await Promise.all([getSettings(), listSales({ status: 'confirmed' })]);
  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="/">
          <BrandMark />
          <span><b>Ledgerline</b><small>{settings.company_name}</small></span>
        </a>
        <nav className="nav" aria-label="Main">
          <span className="nav-label">Overview</span>
          <NavLink href="/" exact>Dashboard</NavLink>
          <span className="nav-label">Operations</span>
          <NavLink href="/sales" badge={toShip.length || null}>Sales orders</NavLink>
          <NavLink href="/purchases">Purchasing</NavLink>
          <NavLink href="/products">Inventory</NavLink>
          <NavLink href="/partners">Customers &amp; suppliers</NavLink>
          {(can(user.role, 'users.manage') || can(user.role, 'audit.view')) && <span className="nav-label">Admin</span>}
          {can(user.role, 'users.manage') && <NavLink href="/users">Users &amp; roles</NavLink>}
          {can(user.role, 'audit.view') && <NavLink href="/activity">Activity log</NavLink>}
        </nav>
        <div className="me">
          <span className="who">{user.name}<br /><span className="role">{ROLES[user.role]}</span></span>
          <form action={logout}><button type="submit">Sign out</button></form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
