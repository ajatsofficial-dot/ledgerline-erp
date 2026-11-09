import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getSale, getSettings } from '@/lib/queries';
import { fmtDate, fmtDateTime, fmtNumber } from '@/lib/format';
import { SALES_FLOW } from '@/lib/inventory';
import { moveSale } from '../../../actions';
import { Badge, Flash, Flow, Money, PageHead } from '../../../ui';

export const metadata = { title: 'Sales order' };

const BUTTONS = {
  confirmed: ['Confirm order', 'sales.confirm', 'btn-primary'],
  shipped: ['Mark shipped', 'sales.ship', 'btn-primary'],
  paid: ['Record payment', 'sales.pay', 'btn-primary'],
  cancelled: ['Cancel order', 'sales.cancel', 'btn-danger'],
};

export default async function SalePage({ params, searchParams }) {
  const user = await requireUser();
  const [o, settings] = await Promise.all([getSale(Number(params.id)), getSettings()]);
  if (!o) notFound();
  const cur = settings.currency;
  const next = (SALES_FLOW[o.status] || []).filter((s) => can(user.role, BUTTONS[s][1]));
  const blocked = (SALES_FLOW[o.status] || []).filter((s) => !can(user.role, BUTTONS[s][1]));

  return (
    <>
      <PageHead eyebrow={`Sales order · ${o.customer}`} title={o.number}>
        <Link className="btn" href="/sales">All orders</Link>
        {o.status !== 'draft' && o.status !== 'cancelled' && <Link className="btn" href={`/invoice/${o.id}`} target="_blank">Invoice</Link>}
        {next.map((to) => (
          <form key={to} action={moveSale}>
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="to" value={to} />
            <button className={`btn ${BUTTONS[to][2]}`} type="submit">{BUTTONS[to][0]}</button>
          </form>
        ))}
      </PageHead>
      <Flash searchParams={searchParams} />
      {o.status !== 'cancelled' ? <Flow steps={['draft', 'confirmed', 'shipped', 'paid']} current={o.status} /> : <Badge status="cancelled" />}
      {blocked.length > 0 && <p className="muted" style={{ fontSize: '.88rem' }}>Next step for this order ({blocked.map((b) => BUTTONS[b][0].toLowerCase()).join(', ')}) is handled by another role.</p>}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Lines</h2><Badge status={o.status} /></div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Line total</th></tr></thead>
              <tbody>
                {o.lines.map((l) => (
                  <tr key={l.id}>
                    <td><Link className="row-link" href={`/products/${l.product_id}`}>{l.name}</Link>
                      <span className="sub">{l.sku}{o.status === 'confirmed' ? ` · ${l.on_hand} on hand${l.on_hand < l.qty ? ' · short' : ''}` : ''}</span></td>
                    <td className="num">{fmtNumber(l.qty)} {l.unit}</td>
                    <td className="num"><Money cents={l.unit_cents} currency={cur} /></td>
                    <td className="num strong"><Money cents={l.qty * l.unit_cents} currency={cur} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-body">
            <div className="totals">
              <span>Subtotal</span><span className="mono">{fmtMoneyCell(o.subtotal, cur)}</span>
              <span>Tax ({Math.round(o.tax_rate * 1000) / 10}%)</span><span className="mono">{fmtMoneyCell(o.tax, cur)}</span>
              <span className="grand">Total</span><span className="grand mono">{fmtMoneyCell(o.total, cur)}</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Details</h2></div>
          <div className="panel-body">
            <dl className="dl">
              <dt>Customer</dt><dd>{o.customer}<span className="sub">{o.contact} · {o.customer_city}</span></dd>
              <dt>Order date</dt><dd>{fmtDate(o.order_date)}</dd>
              <dt>Created by</dt><dd>{o.created_by_name || '—'}</dd>
              <dt>Shipped</dt><dd>{fmtDateTime(o.shipped_at)}</dd>
              <dt>Paid</dt><dd>{fmtDateTime(o.paid_at)}</dd>
              <dt>Terms</dt><dd>{settings.payment_terms}</dd>
              {o.notes && <><dt>Notes</dt><dd>{o.notes}</dd></>}
            </dl>
          </div>
        </section>
      </div>
    </>
  );
}

function fmtMoneyCell(cents, cur) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(cents / 100);
}
