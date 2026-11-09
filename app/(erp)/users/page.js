import { requireUser } from '@/lib/auth';
import { PERMISSION_TABLE, ROLES } from '@/lib/permissions';
import { listUsers } from '@/lib/queries';
import { createUser, updateUser } from '../../actions';
import { Flash, PageHead } from '../../ui';

export const metadata = { title: 'Users & roles' };

const ACTION_LABEL = {
  'products.edit': 'Create and edit products', 'stock.adjust': 'Adjust stock', 'partners.edit': 'Add customers and suppliers',
  'sales.edit': 'Create sales orders', 'sales.confirm': 'Confirm sales orders', 'sales.ship': 'Ship sales orders', 'sales.pay': 'Record payments',
  'sales.cancel': 'Cancel sales orders', 'purchase.edit': 'Create purchase orders', 'purchase.receive': 'Receive goods',
  'users.manage': 'Manage users', 'audit.view': 'View activity log',
};

export default async function Users({ searchParams }) {
  const me = await requireUser('users.manage');
  const users = await listUsers();
  return (
    <>
      <PageHead eyebrow="Admin" title="Users and roles" />
      <Flash searchParams={searchParams} />
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Team</h2></div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Name</th><th>Role</th><th>Active</th><th><span className="sr-only">Save</span></th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="strong">{u.name}{u.id === me.id ? ' (you)' : ''}<span className="sub">{u.email}</span></td>
                    <td colSpan={3}>
                      <form action={updateUser} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="hidden" name="id" value={u.id} />
                        <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.name}</label>
                        <select id={`role-${u.id}`} name="role" defaultValue={u.role} style={{ width: 'auto' }}>
                          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <label className="check"><input type="checkbox" name="active" defaultChecked={Boolean(u.active)} /> Active</label>
                        <button className="btn" type="submit">Save</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <form action={createUser} className="panel">
          <div className="panel-head"><h2>Invite a team member</h2></div>
          <div className="panel-body stack">
            <label className="f">Name<input name="name" type="text" required /></label>
            <label className="f">Work email<input name="email" type="email" required /></label>
            <label className="f">Role
              <select name="role" defaultValue="sales">{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="f">Temporary password <span className="hint">At least 8 characters. Share it privately.</span><input name="password" type="password" autoComplete="new-password" required minLength={8} /></label>
            <div><button className="btn btn-primary" type="submit">Create user</button></div>
          </div>
        </form>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>What each role can do</h2></div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Permission</th>{Object.values(ROLES).map((r) => <th key={r} style={{ textAlign: 'center' }}>{r}</th>)}</tr></thead>
            <tbody>
              {PERMISSION_TABLE.map(([action, roles]) => (
                <tr key={action}>
                  <td>{ACTION_LABEL[action] || action}</td>
                  {Object.keys(ROLES).map((r) => <td key={r} style={{ textAlign: 'center' }} className="mono">{roles.includes(r) ? <span style={{ color: 'var(--ok)' }} aria-label="Allowed">●</span> : <span className="muted" aria-label="Not allowed">–</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
