import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getSale, getSettings } from '@/lib/queries';
import { fmtDate, fmtMoney, fmtNumber, addDaysIso } from '@/lib/format';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Invoice' };

export default async function Invoice({ params }) {
  await requireUser();
  const [o, s] = await Promise.all([getSale(Number(params.id)), getSettings()]);
  if (!o || o.status === 'draft' || o.status === 'cancelled') notFound();
  const days = Number((s.payment_terms || '').match(/\d+/)?.[0] || 30);
  const due = addDaysIso((o.shipped_at || o.order_date).slice(0, 10), days);
  const cur = s.currency;

  return (
    <>
      <div className="invoice-bar">
        <Link className="btn" href={`/sales/${o.id}`}>← Back to order</Link>
        <PrintButton />
      </div>
      <article className="invoice">
        <div className="head">
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ fontSize: '1.2rem' }}>{s.company_name}</strong>
            <span className="muted">{s.company_address}</span>
            <span className="muted">{s.company_email}</span>
          </div>
          <div style={{ textAlign: 'right', display: 'grid', gap: 4 }}>
            <h1>Invoice</h1>
            <span className="mono">{o.number.replace('SO', 'INV')}</span>
            <span className={o.status === 'paid' ? '' : 'muted'} style={{ fontWeight: 600, color: o.status === 'paid' ? '#2F7D4F' : undefined }}>{o.status === 'paid' ? 'Paid' : `Due ${fmtDate(due)}`}</span>
          </div>
        </div>
        <div className="head">
          <div style={{ display: 'grid', gap: 2 }}>
            <span className="eyebrow">Bill to</span>
            <strong>{o.customer}</strong>
            <span>{o.contact}</span>
            <span className="muted">{o.customer_email}</span>
            <span className="muted">{o.customer_city}</span>
          </div>
          <dl className="dl" style={{ alignSelf: 'start' }}>
            <dt>Order</dt><dd className="mono">{o.number}</dd>
            <dt>Order date</dt><dd>{fmtDate(o.order_date)}</dd>
            <dt>Terms</dt><dd>{s.payment_terms}</dd>
          </dl>
        </div>
        <table className="t">
          <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {o.lines.map((l) => (
              <tr key={l.id}><td>{l.name}<span className="sub">{l.sku}</span></td><td className="num">{fmtNumber(l.qty)} {l.unit}</td><td className="num mono">{fmtMoney(l.unit_cents, cur)}</td><td className="num mono">{fmtMoney(l.qty * l.unit_cents, cur)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="totals" style={{ marginTop: 18 }}>
          <span>Subtotal</span><span className="mono">{fmtMoney(o.subtotal, cur)}</span>
          <span>Tax ({Math.round(o.tax_rate * 1000) / 10}%)</span><span className="mono">{fmtMoney(o.tax, cur)}</span>
          <span className="grand">Total due</span><span className="grand mono">{fmtMoney(o.status === 'paid' ? 0 : o.total, cur)}</span>
        </div>
        {o.notes && <p style={{ marginTop: 24 }}><strong>Notes:</strong> {o.notes}</p>}
        <p className="muted" style={{ marginTop: 32, fontSize: '.85rem' }}>Thank you for your business. Please include {o.number.replace('SO', 'INV')} with your payment.</p>
      </article>
    </>
  );
}
