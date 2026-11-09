import { saveProduct } from '../../actions';

export default function ProductForm({ product, categories, readOnly }) {
  const p = product || {};
  return (
    <form action={saveProduct} className="panel">
      <div className="panel-head"><h2>{product ? 'Product details' : 'New product'}</h2></div>
      <fieldset className="panel-body stack" disabled={readOnly} style={{ border: 0, margin: 0 }}>
        {product && <input type="hidden" name="id" value={p.id} />}
        <div className="form-grid">
          <label className="f">SKU<input name="sku" type="text" defaultValue={p.sku} required placeholder="e.g. FAS-HXB-0516" /></label>
          <label className="f">Category
            <input name="category" type="text" list="categories" defaultValue={p.category} required />
            <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
        </div>
        <label className="f">Name<input name="name" type="text" defaultValue={p.name} required /></label>
        <div className="form-grid">
          <label className="f">Unit<input name="unit" type="text" defaultValue={p.unit || 'each'} required /></label>
          <label className="f">Sale price<input name="price" type="text" inputMode="decimal" defaultValue={product ? (p.price_cents / 100).toFixed(2) : ''} required placeholder="0.00" /></label>
          {!product && <label className="f">Unit cost<input name="cost" type="text" inputMode="decimal" placeholder="0.00" required /></label>}
          <label className="f">Reorder level <span className="hint">Alert when available stock reaches this</span><input name="reorderLevel" type="number" min="0" defaultValue={p.reorder_level ?? 0} /></label>
          {!product && <label className="f">Opening stock<input name="openingQty" type="number" min="0" defaultValue="0" /></label>}
        </div>
        {product && <label className="check"><input type="checkbox" name="active" defaultChecked={Boolean(p.active)} /> Active (can be added to new sales orders)</label>}
        {!readOnly && <div><button className="btn btn-primary" type="submit">{product ? 'Save changes' : 'Create product'}</button></div>}
      </fieldset>
    </form>
  );
}
