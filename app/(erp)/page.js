import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { dashboard, getSettings } from '@/lib/queries';
import { fmtDate, fmtMoney, fmtMoneyShort, fmtNumber, todayIso } from '@/lib/format';
import { Badge, Flash, Money, PageHead } from '../ui';

export const metadata = { title: 'Dashboard' };

function niceMax(v) {
  if (v <= 0) return 100000;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function SalesChart({ series, currency }) {
  const W = 720, H = 200, L = 52, R = 8, T = 10, B = 26;
  const max = niceMax(Math.max(...series.map((d) => d.cents)));
  const bw = (W - L - R) / series.length;
  const y = (c) => T + (H - T - B) * (1 - c / max);
  const ticks = [0, max / 2, max];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Shipped sales per day, last 30 days">
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text x={L - 8} y={y(t) + 3} textAnchor="end">{fmtMoneyShort(t, currency)}</text>
        </g>
      ))}
      {series.map((d, i) => (
        <g key={d.date}>
          <rect className={`bar${d.cents ? '' : ' zero'}`} x={L + i * bw + 2} y={d.cents ? y(d.cents) : H - B - 1} width={Math.max(bw - 4, 1)} height={d.cents ? H - B - y(d.cents) : 1} rx="1.5">
            <title>{`${fmtDate(d.date, { month: 'short', day: 'numeric' })}: ${fmtMoney(d.cents, currency)}`}</title>
          </rect>
          {i % 5 === 0 && <text x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle">{fmtDate(d.date, { month: 'short', day: 'numeric' })}</text>}
        </g>
      ))}
    </svg>
  );
}

export default async function Dashboard({ searchParams }) {
  const user = await requireUser();
  const [settings, d] = await Promise.all([getSettings(), dashboard(todayIso())]);
  const cur = settings.currency;
  const thirty = d.series.reduce((s, x) => s + x.cents, 0);

  return (
    <>
      <PageHead eyebrow={fmtDate(todayIso(), { weekday: 'long', month: 'long', day: 'numeric' })} title={`Good to see you, ${user.name.split(' ')[0]}`}>
        <Link className="btn" href="/products?filter=low">Reorder list</Link>
        <Link className="btn btn-primary" href="/sales/new">New sales order</Link>
      </PageHead>
      <Flash searchParams={searchParams} />

      <section className="kpis" aria-label="Key figures">
        <div className="kpi"><span className="l">Sales this month</span><span className="v">{fmtMoney(d.monthSales, cur)}</span><span className="s">Shipped and paid, before tax</span></div>
        <Link className="kpi" href="/sales?status=confirmed"><span className="l">Waiting to ship</span><span className="v">{d.openOrders.count}</span><span className="s">{fmtMoney(d.openOrders.value, cur)} confirmed</span></Link>
        <Link className="kpi" href="/sales?status=shipped"><span className="l">Unpaid invoices</span><span className="v">{fmtMoney(d.unpaid.value, cur)}</span><span className="s">{d.unpaid.count} shipped, not yet paid</span></Link>
        <Link className={`kpi${d.low.length ? ' alert' : ''}`} href="/products?filter=low"><span className="l">Low or out of stock</span><span className="v">{d.low.length}</span><span className="s">Inventory value {fmtMoneyShort(d.inventoryValue, cur)}</span></Link>
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Shipped sales, last 30 days</h2>
            <span className="mono muted">{fmtMoney(thirty, cur)}</span>
          </div>
          <div className="panel-body"><SalesChart series={d.series} currency={cur} /></div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Needs reordering</h2><Link href="/purchases/new">Create PO →</Link></div>
          {d.low.length === 0 ? <p className="empty">Every product is above its reorder level.</p> : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Product</th><th className="num">Available</th><th className="num">Reorder at</th></tr></thead>
                <tbody>
                  {d.low.slice(0, 5).map((p) => (
                    <tr key={p.id}>
                      <td><Link className="row-link" href={`/products/${p.id}`}>{p.name}</Link><span className="sub">{p.sku}{p.incoming ? ` · ${p.incoming} incoming` : ''}</span></td>
                      <td className="num"><Badge status={p.level} /> {p.available < 0 ? <span className="mono" style={{ color: 'var(--bad)' }}>{fmtNumber(-p.available)} short</span> : fmtNumber(p.available)}</td>
                      <td className="num">{p.reorder_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Recent sales orders</h2><Link href="/sales">All orders →</Link></div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="num">Total</th></tr></thead>
              <tbody>
                {d.recent.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="row-link" href={`/sales/${o.id}`}>{o.number}</Link><span className="sub">{fmtDate(o.order_date)}</span></td>
                    <td>{o.customer}</td>
                    <td><Badge status={o.status} /></td>
                    <td className="num"><Money cents={o.total} currency={cur} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Top products, 30 days</h2></div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Product</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
              <tbody>
                {d.top.map((p) => (
                  <tr key={p.sku}><td>{p.name}<span className="sub">{p.sku}</span></td><td className="num">{fmtNumber(p.qty)}</td><td className="num"><Money cents={p.cents} currency={cur} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
