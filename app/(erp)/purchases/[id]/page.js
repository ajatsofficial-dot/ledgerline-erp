import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getPurchase, getSettings } from '@/lib/queries';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber } from '@/lib/format';
import { PURCHASE_FLOW } from '@/lib/inventory';
import { movePurchase } from '../../../actions';
import { Badge, Flash, Flow, Money, PageHead } from '../../../ui';

export const metadata = { title: 'Purchase order' };

const BUTTONS = {
  ordered: ['Mark as ordered', 'purchase.edit', 'btn-primary'],
  received: ['Receive goods', 'purchase.receive', 'btn-primary'],
  cancelled: ['Cancel PO', 'purchase.edit', 'btn-danger'],
};

export default async function PurchasePage({ params, searchParams }) {
  const user = await requireUser();
  const [o, settings] = await Promise.all([getPurchase(Number(params.id)), getSettings()]);
  if (!o) notFound();
  const cur = settings.currency;
  const next = (PURCHASE_FLOW[o.status] || []).filter((s) => can(user.role, BUTTONS[s][1]));

  return (
    <>
      <PageHead eyebrow={`Purchase order · ${o.supplier}`} title={o.number}>
        <Link className="btn" href="/purchases">All purchase orders</Link>
        {next.map((to) => (
          <form key={to} action={movePurchase}>
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="to" value={to} />
            <button className={`btn ${BUTTONS[to][2]}`} type="submit">{BUTTONS[to][0]}</button>
          </form>
        ))}
      </PageHead>
      <Flash searchParams={searchParams} />
      {o.status !== 'cancelled' ? <Flow steps={['draft', 'ordered', 'received']} current={o.status} /> : <Badge status="cancelled" />}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Lines</h2><Badge status={o.status} /></div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Unit cost</th><th className="num">Current avg</th><th className="num">Line total</th></tr></thead>
              <tbody>
                {o.lines.map((l) => (
                  <tr key={l.id}>
                    <td><Link className="row-link" href={`/products/${l.product_id}`}>{l.name}</Link><span className="sub">{l.sku}</span></td>
                    <td className="num">{fmtNumber(l.qty)} {l.unit}</td>
                    <td className="num"><Money cents={l.unit_cents} currency={cur} /></td>
                    <td className="num muted"><Money cents={l.cost_cents} currency={cur} /></td>
                    <td className="num strong"><Money cents={l.qty * l.unit_cents} currency={cur} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={4} className="muted">Total</td><td className="num strong">{fmtMoney(o.total, cur)}</td></tr></tfoot>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Details</h2></div>
          <div className="panel-body">
            <dl className="dl">
              <dt>Supplier</dt><dd>{o.supplier}<span className="sub">{o.contact} · {o.supplier_email}</span></dd>
              <dt>Ordered</dt><dd>{fmtDate(o.order_date)}</dd>
              <dt>Expected</dt><dd>{fmtDate(o.expected_date)}</dd>
              <dt>Received</dt><dd>{fmtDateTime(o.received_at)}</dd>
              <dt>Created by</dt><dd>{o.created_by_name || '—'}</dd>
              {o.notes && <><dt>Notes</dt><dd>{o.notes}</dd></>}
            </dl>
            {o.status === 'ordered' && <p className="muted" style={{ marginTop: 14, fontSize: '.88rem' }}>Receiving adds these quantities to stock and recalculates each product's moving average cost.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
