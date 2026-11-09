import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getProduct, getSettings, productCategories, productMoves } from '@/lib/queries';
import { fmtDateTime, fmtMoney, fmtNumber } from '@/lib/format';
import { adjustStock } from '../../../actions';
import { Badge, Flash, PageHead } from '../../../ui';
import ProductForm from '../ProductForm';

export const metadata = { title: 'Product' };

const KIND = { opening: 'Opening balance', receipt: 'Received', shipment: 'Shipped', adjustment: 'Adjustment' };

export default async function ProductPage({ params, searchParams }) {
  const user = await requireUser();
  const id = Number(params.id);
  const [product, moves, categories, settings] = await Promise.all([getProduct(id), productMoves(id), productCategories(), getSettings()]);
  if (!product) notFound();
  const canEdit = can(user.role, 'products.edit');
  const pct = Math.max(0, Math.min(100, Math.round((product.available / Math.max(product.reorder_level * 3, 1)) * 100)));

  return (
    <>
      <PageHead eyebrow={`Inventory · ${product.sku}`} title={product.name}>
        <Link className="btn" href="/products">Back to inventory</Link>
        {can(user.role, 'purchase.edit') && <Link className="btn" href={`/purchases/new?product=${product.id}`}>Reorder</Link>}
      </PageHead>
      <Flash searchParams={searchParams} />

      <section className="kpis">
        <div className="kpi"><span className="l">On hand</span><span className="v">{fmtNumber(product.on_hand)}</span><span className="s">per {product.unit}</span></div>
        <div className="kpi"><span className="l">Reserved</span><span className="v">{fmtNumber(product.reserved)}</span><span className="s">by confirmed orders</span></div>
        <div className={`kpi${product.level !== 'ok' ? ' alert' : ''}`}>
          <span className="l">Available</span><span className="v">{fmtNumber(product.available)}</span>
          <span className="meter" aria-hidden="true"><i className={product.level} style={{ width: `${pct}%` }} /></span>
        </div>
        <div className="kpi"><span className="l">Stock value</span><span className="v">{fmtMoney(Math.max(product.on_hand, 0) * product.cost_cents, settings.currency)}</span><span className="s">avg cost {fmtMoney(product.cost_cents, settings.currency)}</span></div>
      </section>

      <div className="grid-2">
        <div className="stack">
          <ProductForm product={product} categories={categories} readOnly={!canEdit} />
          <section className="panel">
            <div className="panel-head"><h2>Stock movements</h2><Badge status={product.level} /></div>
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>When</th><th>Type</th><th>Reference</th><th>By</th><th className="num">Qty</th></tr></thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.id}>
                      <td className="mono" style={{ fontSize: '.85rem' }}>{fmtDateTime(m.created_at)}</td>
                      <td>{KIND[m.kind]}</td>
                      <td>{m.reference}</td>
                      <td className="muted">{m.user_name || '—'}</td>
                      <td className="num strong" style={{ color: m.qty < 0 ? 'var(--bad)' : 'var(--ok)' }}>{m.qty > 0 ? '+' : ''}{fmtNumber(m.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="stack">
          {can(user.role, 'stock.adjust') && (
            <form action={adjustStock} className="panel">
              <div className="panel-head"><h2>Adjust stock</h2></div>
              <div className="panel-body stack">
                <input type="hidden" name="productId" value={product.id} />
                <label className="f">Quantity <span className="hint">Use a minus sign to remove, e.g. -3</span><input name="qty" type="number" step="1" required /></label>
                <label className="f">Reason<input name="reason" type="text" placeholder="Cycle count, damaged, found…" required /></label>
                <div><button className="btn btn-primary" type="submit">Record adjustment</button></div>
              </div>
            </form>
          )}
          <section className="panel">
            <div className="panel-head"><h2>Pipeline</h2></div>
            <div className="panel-body">
              <dl className="dl">
                <dt>Incoming</dt><dd className="mono">{product.incoming ? `+${fmtNumber(product.incoming)} on open POs` : 'None'}</dd>
                <dt>Reorder level</dt><dd className="mono">{product.reorder_level}</dd>
                <dt>Margin</dt><dd className="mono">{product.price_cents ? `${Math.round(((product.price_cents - product.cost_cents) / product.price_cents) * 100)}%` : '—'}</dd>
              </dl>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
