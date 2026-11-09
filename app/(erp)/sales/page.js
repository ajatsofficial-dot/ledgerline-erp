import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getSettings, listSales } from '@/lib/queries';
import { fmtDate } from '@/lib/format';
import { Badge, Flash, Money, PageHead } from '../../ui';

export const metadata = { title: 'Sales orders' };
const TABS = [['', 'All'], ['draft', 'Draft'], ['confirmed', 'To ship'], ['shipped', 'Unpaid'], ['paid', 'Paid'], ['cancelled', 'Cancelled']];

export default async function Sales({ searchParams }) {
  const user = await requireUser();
  const status = String(searchParams.status || '');
  const search = String(searchParams.q || '');
  const [settings, orders] = await Promise.all([getSettings(), listSales({ status, search })]);
  const sum = orders.reduce((s, o) => s + o.total, 0);

  return (
    <>
      <PageHead eyebrow="Sales" title="Sales orders">
        <a className="btn" href="/api/export/sales">Export CSV</a>
        {can(user.role, 'sales.edit') && <Link className="btn btn-primary" href="/sales/new">New sales order</Link>}
      </PageHead>
      <Flash searchParams={searchParams} />
      <section className="panel">
        <form className="toolbar" action="/sales">
          <div className="tabs">
            {TABS.map(([v, l]) => <Link key={v} href={`/sales${v ? `?status=${v}` : ''}`} aria-current={status === v ? 'true' : undefined}>{l}</Link>)}
          </div>
          {status && <input type="hidden" name="status" value={status} />}
          <label className="sr-only" htmlFor="q">Search orders</label>
          <input id="q" type="search" name="q" defaultValue={search} placeholder="Order number or customer" style={{ marginLeft: 'auto' }} />
        </form>
        {orders.length === 0 ? <p className="empty">No orders here yet.</p> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Status</th><th className="num">Subtotal</th><th className="num">Total</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="row-link" href={`/sales/${o.id}`}>{o.number}</Link></td>
                    <td className="mono">{fmtDate(o.order_date)}</td>
                    <td>{o.customer}</td>
                    <td><Badge status={o.status} /></td>
                    <td className="num muted"><Money cents={o.subtotal} currency={settings.currency} /></td>
                    <td className="num strong"><Money cents={o.total} currency={settings.currency} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={5} className="muted">{orders.length} orders</td><td className="num strong"><Money cents={sum} currency={settings.currency} /></td></tr></tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
