'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { fmtMoney, todayIso, addDaysIso } from '@/lib/format';
import { orderTotals } from '@/lib/inventory';

function Submit({ label }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Saving…' : label}</button>;
}

let nextKey = 1;
const newLine = (productId = '') => ({ key: nextKey++, productId: String(productId), qty: 1, unit: '' });

export default function OrderForm({ kind, action, partners, products, taxRate = 0, currency = 'USD', initialProductId }) {
  const isSale = kind === 'sale';
  const [state, formAction] = useFormState(action, null);
  const [lines, setLines] = useState(() => [newLine(initialProductId || '')]);
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [String(p.id), p])), [products]);

  const priced = lines.map((l) => {
    const p = byId[l.productId];
    const defaultCents = p ? (isSale ? p.price_cents : p.cost_cents) : 0;
    const unitCents = l.unit === '' ? defaultCents : Math.round(Number(l.unit) * 100) || 0;
    return { ...l, p, unitCents };
  });
  const filled = priced.filter((l) => l.p && Number(l.qty) > 0);
  const totals = orderTotals(filled.map((l) => ({ qty: l.qty, unit_cents: l.unitCents })), isSale ? taxRate : 0);
  const payload = JSON.stringify(filled.map((l) => ({ productId: Number(l.productId), qty: Number(l.qty), unitCents: l.unitCents })));

  const update = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="lines" value={payload} />
      <section className="panel">
        <div className="panel-head"><h2>{isSale ? 'Customer and date' : 'Supplier and dates'}</h2></div>
        <div className="panel-body form-grid">
          <label className="f">{isSale ? 'Customer' : 'Supplier'}
            <select name="partnerId" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="f">Order date<input name="orderDate" type="date" defaultValue={todayIso()} required /></label>
          {!isSale && <label className="f">Expected delivery<input name="expectedDate" type="date" defaultValue={addDaysIso(todayIso(), 7)} /></label>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Lines</h2>
          <button type="button" className="btn" onClick={() => setLines((ls) => [...ls, newLine()])}>Add line</button>
        </div>
        <div className="table-wrap">
          <table className="t lines">
            <thead><tr><th style={{ minWidth: 260 }}>Product</th><th className="num" style={{ width: 110 }}>Qty</th><th className="num" style={{ width: 140 }}>{isSale ? 'Unit price' : 'Unit cost'}</th><th className="num">Line total</th><th><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {priced.map((l, i) => {
                const over = isSale && l.p && Number(l.qty) > l.p.available;
                return (
                  <tr key={l.key}>
                    <td>
                      <label className="sr-only" htmlFor={`p-${l.key}`}>Product for line {i + 1}</label>
                      <select id={`p-${l.key}`} value={l.productId} onChange={(e) => update(l.key, { productId: e.target.value, unit: '' })}>
                        <option value="">Choose a product…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
                      </select>
                      {l.p && (
                        <span className="sub" style={over ? { color: 'var(--warn)' } : undefined}>
                          {l.p.available} available{l.p.incoming ? ` · ${l.p.incoming} incoming` : ''}{over ? ' · more than available, ship once stock arrives' : ''}
                        </span>
                      )}
                    </td>
                    <td className="num">
                      <label className="sr-only" htmlFor={`q-${l.key}`}>Quantity for line {i + 1}</label>
                      <input id={`q-${l.key}`} type="number" min="1" step="1" value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} style={{ textAlign: 'right' }} />
                    </td>
                    <td className="num">
                      <label className="sr-only" htmlFor={`u-${l.key}`}>Unit amount for line {i + 1}</label>
                      <input id={`u-${l.key}`} type="number" min="0" step="0.01" placeholder={l.p ? ((isSale ? l.p.price_cents : l.p.cost_cents) / 100).toFixed(2) : '0.00'} value={l.unit} onChange={(e) => update(l.key, { unit: e.target.value })} style={{ textAlign: 'right' }} />
                    </td>
                    <td className="num mono">{fmtMoney(l.p ? Number(l.qty) * l.unitCents : 0, currency)}</td>
                    <td className="num"><button type="button" className="btn btn-danger" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [newLine()]))} aria-label={`Remove line ${i + 1}`}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="panel-body">
          <div className="totals">
            <span>Subtotal</span><span className="mono">{fmtMoney(totals.subtotal, currency)}</span>
            {isSale && <><span>Tax ({Math.round(taxRate * 1000) / 10}%)</span><span className="mono">{fmtMoney(totals.tax, currency)}</span></>}
            <span className="grand">Total</span><span className="grand mono">{fmtMoney(totals.total, currency)}</span>
          </div>
        </div>
      </section>

      <label className="f">Notes <span className="hint">Optional, shown on the {isSale ? 'invoice' : 'purchase order'}</span><textarea name="notes" maxLength={500} /></label>
      {state?.error && <p className="flash error" role="alert">{state.error}</p>}
      <div className="actions"><Submit label={isSale ? 'Create sales order' : 'Create purchase order'} /></div>
    </form>
  );
}
