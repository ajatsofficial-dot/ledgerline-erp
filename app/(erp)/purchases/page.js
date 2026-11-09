import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getSettings, listPurchases } from '@/lib/queries';
import { fmtDate } from '@/lib/format';
import { Badge, Flash, Money, PageHead } from '../../ui';

export const metadata = { title: 'Purchasing' };
const TABS = [['', 'All'], ['draft', 'Draft'], ['ordered', 'Ordered'], ['received', 'Received'], ['cancelled', 'Cancelled']];

export default async function Purchases({ searchParams }) {
  const user = await requireUser();
  const status = String(searchParams.status || '');
  const [settings, orders] = await Promise.all([getSettings(), listPurchases({ status })]);
  return (
    <>
      <PageHead eyebrow="Purchasing" title="Purchase orders">
        {can(user.role, 'purchase.edit') && <Link className="btn btn-primary" href="/purchases/new">New purchase order</Link>}
      </PageHead>
      <Flash searchParams={searchParams} />
      <section className="panel">
        <div className="toolbar">
          <div className="tabs">
            {TABS.map(([v, l]) => <Link key={v} href={`/purchases${v ? `?status=${v}` : ''}`} aria-current={status === v ? 'true' : undefined}>{l}</Link>)}
          </div>
        </div>
        {orders.length === 0 ? <p className="empty">No purchase orders here.</p> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>PO</th><th>Supplier</th><th>Ordered</th><th>Expected</th><th>Status</th><th className="num">Total</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="row-link" href={`/purchases/${o.id}`}>{o.number}</Link></td>
                    <td>{o.supplier}</td>
                    <td className="mono">{fmtDate(o.order_date)}</td>
                    <td className="mono">{o.status === 'received' ? 'Received' : fmtDate(o.expected_date)}</td>
                    <td><Badge status={o.status} /></td>
                    <td className="num strong"><Money cents={o.total} currency={settings.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
