import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getSettings, listProducts, productCategories } from '@/lib/queries';
import { fmtNumber } from '@/lib/format';
import { Badge, Flash, Money, PageHead } from '../../ui';

export const metadata = { title: 'Inventory' };

export default async function Products({ searchParams }) {
  const user = await requireUser();
  const search = String(searchParams.q || '');
  const category = String(searchParams.category || '');
  const filter = searchParams.filter === 'low' ? 'low' : '';
  const [settings, products, categories] = await Promise.all([getSettings(), listProducts({ search, category, filter }), productCategories()]);
  const qs = (patch) => '?' + new URLSearchParams(Object.entries({ q: search, category, filter, ...patch }).filter(([, v]) => v)).toString();

  return (
    <>
      <PageHead eyebrow="Inventory" title="Products and stock">
        <a className="btn" href="/api/export/products">Export CSV</a>
        {can(user.role, 'products.edit') && <Link className="btn btn-primary" href="/products/new">New product</Link>}
      </PageHead>
      <Flash searchParams={searchParams} />
      <section className="panel">
        <form className="toolbar" action="/products">
          <label className="sr-only" htmlFor="q">Search products</label>
          <input id="q" type="search" name="q" defaultValue={search} placeholder="Search SKU or name" />
          <label className="sr-only" htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={category} style={{ width: 'auto' }}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          {filter && <input type="hidden" name="filter" value={filter} />}
          <button className="btn" type="submit">Filter</button>
          <div className="tabs" style={{ marginLeft: 'auto' }}>
            <Link href={qs({ filter: '' })} aria-current={!filter ? 'true' : undefined}>All</Link>
            <Link href={qs({ filter: 'low' })} aria-current={filter ? 'true' : undefined}>Low or out</Link>
          </div>
        </form>
        {products.length === 0 ? <p className="empty">No products match. Clear the search or add a product.</p> : (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr><th>Product</th><th>Category</th><th className="num">On hand</th><th className="num">Reserved</th><th className="num">Available</th><th className="num">Incoming</th><th>Status</th><th className="num">Price</th><th className="num">Avg cost</th></tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={p.active ? undefined : { opacity: .55 }}>
                    <td><Link className="row-link" href={`/products/${p.id}`}>{p.name}</Link><span className="sub">{p.sku} · per {p.unit}{p.active ? '' : ' · inactive'}</span></td>
                    <td>{p.category}</td>
                    <td className="num">{fmtNumber(p.on_hand)}</td>
                    <td className="num">{p.reserved ? fmtNumber(p.reserved) : '—'}</td>
                    <td className="num strong" style={p.available < 0 ? { color: 'var(--bad)' } : undefined} title={p.available < 0 ? 'Confirmed orders need more than is on hand' : undefined}>{fmtNumber(p.available)}</td>
                    <td className="num">{p.incoming ? `+${fmtNumber(p.incoming)}` : '—'}</td>
                    <td><Badge status={p.level} /></td>
                    <td className="num"><Money cents={p.price_cents} currency={settings.currency} /></td>
                    <td className="num muted"><Money cents={p.cost_cents} currency={settings.currency} /></td>
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
