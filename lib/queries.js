import { conn, rows } from './db.js';
import { averageCost, canMove, orderTotals, PURCHASE_FLOW, SALES_FLOW, shortages, stockStatus } from './inventory.js';

const q = async (sql, args = []) => rows(await (await conn()).execute({ sql, args }));
const one = async (sql, args = []) => (await q(sql, args))[0];

export async function audit(ex, userId, action, entity, entityId, detail) {
  await ex.execute({
    sql: 'INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?)',
    args: [userId, action, entity, entityId ?? null, detail ?? null],
  });
}

/** Run `fn(tx)` in a write transaction, retrying briefly if another write holds the lock. */
export async function withTx(fn) {
  for (let attempt = 0; ; attempt++) {
    const tx = await (await conn()).transaction('write').catch((e) => e);
    if (tx instanceof Error) {
      if (/SQLITE_BUSY|locked/i.test(tx.message) && attempt < 8) { await new Promise((r) => setTimeout(r, 50 * (attempt + 1))); continue; }
      throw tx;
    }
    try {
      const out = await fn(tx);
      await tx.commit();
      return out;
    } catch (err) {
      try { await tx.rollback(); } catch {}
      if (/SQLITE_BUSY|locked/i.test(String(err?.message)) && attempt < 8) { await new Promise((r) => setTimeout(r, 50 * (attempt + 1))); continue; }
      throw err;
    } finally {
      tx.close();
    }
  }
}

export class UserError extends Error {}

// ---------- Settings ----------
export async function getSettings() {
  const s = Object.fromEntries((await q('SELECT key, value FROM settings')).map((r) => [r.key, r.value]));
  return { ...s, taxRate: Number(s.tax_rate || 0), currency: s.currency || 'USD' };
}

// ---------- Products & stock ----------
const STOCK_SQL = `
  SELECT p.*,
    COALESCE((SELECT SUM(qty) FROM stock_moves m WHERE m.product_id = p.id), 0) AS on_hand,
    COALESCE((SELECT SUM(l.qty) FROM sales_lines l JOIN sales_orders o ON o.id = l.order_id
              WHERE l.product_id = p.id AND o.status = 'confirmed'), 0) AS reserved,
    COALESCE((SELECT SUM(l.qty) FROM purchase_lines l JOIN purchase_orders o ON o.id = l.order_id
              WHERE l.product_id = p.id AND o.status = 'ordered'), 0) AS incoming
  FROM products p`;

function withStatus(p) {
  return { ...p, ...stockStatus({ onHand: p.on_hand, reserved: p.reserved, reorderLevel: p.reorder_level }) };
}

export async function listProducts({ search = '', category = '', filter = '' } = {}) {
  const like = `%${search}%`;
  const list = (await q(`${STOCK_SQL} WHERE (p.sku LIKE ? OR p.name LIKE ?) AND (? = '' OR p.category = ?) ORDER BY p.category, p.name`,
    [like, like, category, category])).map(withStatus);
  return filter === 'low' ? list.filter((p) => p.level !== 'ok') : list;
}

export async function getProduct(id) {
  const p = await one(`${STOCK_SQL} WHERE p.id = ?`, [id]);
  return p ? withStatus(p) : null;
}

export async function productCategories() {
  return (await q('SELECT DISTINCT category FROM products ORDER BY category')).map((r) => r.category);
}

export async function productMoves(id, limit = 25) {
  return q(`SELECT m.*, u.name AS user_name FROM stock_moves m LEFT JOIN users u ON u.id = m.user_id
            WHERE m.product_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT ?`, [id, limit]);
}

export async function saveProduct(user, data) {
  return withTx(async (tx) => {
    const dupe = rows(await tx.execute({ sql: 'SELECT id FROM products WHERE sku = ? AND id != ?', args: [data.sku, data.id || 0] }))[0];
    if (dupe) throw new UserError(`SKU ${data.sku} is already used by another product.`);
    if (data.id) {
      await tx.execute({
        sql: 'UPDATE products SET sku=?, name=?, category=?, unit=?, price_cents=?, reorder_level=?, active=? WHERE id=?',
        args: [data.sku, data.name, data.category, data.unit, data.priceCents, data.reorderLevel, data.active ? 1 : 0, data.id],
      });
      await audit(tx, user.id, 'updated', 'product', data.id, data.sku);
      return data.id;
    }
    const r = await tx.execute({
      sql: 'INSERT INTO products (sku, name, category, unit, price_cents, cost_cents, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [data.sku, data.name, data.category, data.unit, data.priceCents, data.costCents, data.reorderLevel],
    });
    const id = Number(r.lastInsertRowid);
    if (data.openingQty > 0) {
      await tx.execute({ sql: "INSERT INTO stock_moves (product_id, qty, kind, reference, user_id) VALUES (?, ?, 'opening', 'Opening balance', ?)", args: [id, data.openingQty, user.id] });
    }
    await audit(tx, user.id, 'created', 'product', id, data.sku);
    return id;
  });
}

export async function adjustStock(user, { productId, qty, reason }) {
  return withTx(async (tx) => {
    const onHand = Number(rows(await tx.execute({ sql: 'SELECT COALESCE(SUM(qty),0) AS n FROM stock_moves WHERE product_id = ?', args: [productId] }))[0].n);
    if (onHand + qty < 0) throw new UserError(`Only ${onHand} on hand. An adjustment of ${qty} would make stock negative.`);
    await tx.execute({ sql: "INSERT INTO stock_moves (product_id, qty, kind, reference, user_id) VALUES (?, ?, 'adjustment', ?, ?)", args: [productId, qty, reason, user.id] });
    await audit(tx, user.id, 'adjusted stock', 'product', productId, `${qty > 0 ? '+' : ''}${qty} · ${reason}`);
  });
}

// ---------- Partners ----------
export async function listPartners(kind) {
  return q(`SELECT pa.*,
      (SELECT COUNT(*) FROM ${kind === 'supplier' ? 'purchase_orders' : 'sales_orders'} o WHERE o.${kind === 'supplier' ? 'supplier_id' : 'customer_id'} = pa.id AND o.status != 'cancelled') AS orders
    FROM partners pa WHERE kind = ? ORDER BY name`, [kind]);
}

export async function createPartner(user, data) {
  return withTx(async (tx) => {
    const r = await tx.execute({
      sql: 'INSERT INTO partners (kind, name, contact, email, phone, city) VALUES (?, ?, ?, ?, ?, ?)',
      args: [data.kind, data.name, data.contact || null, data.email || null, data.phone || null, data.city || null],
    });
    await audit(tx, user.id, 'created', data.kind, Number(r.lastInsertRowid), data.name);
    return Number(r.lastInsertRowid);
  });
}

// ---------- Sales orders ----------
async function linesWithTotals(table, orderIds) {
  if (!orderIds.length) return {};
  const list = await q(`SELECT order_id, qty, unit_cents FROM ${table} WHERE order_id IN (${orderIds.map(() => '?').join(',')})`, orderIds);
  const by = {};
  for (const l of list) (by[l.order_id] ||= []).push(l);
  return by;
}

export async function listSales({ status = '', search = '' } = {}) {
  const like = `%${search}%`;
  const orders = await q(`SELECT o.*, c.name AS customer FROM sales_orders o JOIN partners c ON c.id = o.customer_id
      WHERE (? = '' OR o.status = ?) AND (o.number LIKE ? OR c.name LIKE ?) ORDER BY o.order_date DESC, o.id DESC`, [status, status, like, like]);
  const lines = await linesWithTotals('sales_lines', orders.map((o) => o.id));
  return orders.map((o) => ({ ...o, ...orderTotals(lines[o.id] || [], o.tax_rate) }));
}

export async function getSale(id) {
  const order = await one(`SELECT o.*, c.name AS customer, c.contact, c.email AS customer_email, c.city AS customer_city, u.name AS created_by_name
      FROM sales_orders o JOIN partners c ON c.id = o.customer_id LEFT JOIN users u ON u.id = o.created_by WHERE o.id = ?`, [id]);
  if (!order) return null;
  const lines = await q(`SELECT l.*, p.sku, p.name, p.unit,
      COALESCE((SELECT SUM(qty) FROM stock_moves m WHERE m.product_id = p.id), 0) AS on_hand
      FROM sales_lines l JOIN products p ON p.id = l.product_id WHERE l.order_id = ? ORDER BY l.id`, [id]);
  return { ...order, lines, ...orderTotals(lines, order.tax_rate) };
}

async function nextNumber(tx, table, prefix, start) {
  const n = Number(rows(await tx.execute(`SELECT COALESCE(MAX(id), 0) AS n FROM ${table}`))[0].n);
  return `${prefix}-${start + n + 1}`;
}

export async function createSale(user, { customerId, orderDate, notes, lines }, taxRate) {
  return withTx(async (tx) => {
    const customer = rows(await tx.execute({ sql: "SELECT id FROM partners WHERE id = ? AND kind = 'customer'", args: [customerId] }))[0];
    if (!customer) throw new UserError('Choose a customer.');
    const number = await nextNumber(tx, 'sales_orders', 'SO', 1000);
    const r = await tx.execute({
      sql: "INSERT INTO sales_orders (number, customer_id, status, order_date, tax_rate, notes, created_by) VALUES (?, ?, 'draft', ?, ?, ?, ?)",
      args: [number, customerId, orderDate, taxRate, notes || null, user.id],
    });
    const id = Number(r.lastInsertRowid);
    for (const l of lines) {
      const p = rows(await tx.execute({ sql: 'SELECT id, price_cents FROM products WHERE id = ? AND active = 1', args: [l.productId] }))[0];
      if (!p) throw new UserError('One of the products is no longer available.');
      await tx.execute({ sql: 'INSERT INTO sales_lines (order_id, product_id, qty, unit_cents) VALUES (?, ?, ?, ?)', args: [id, p.id, l.qty, l.unitCents ?? p.price_cents] });
    }
    await audit(tx, user.id, 'created', 'sales order', id, number);
    return id;
  });
}

/** Move a sales order to a new status. Shipping removes stock and fails if any line is short. */
export async function transitionSale(user, id, to) {
  return withTx(async (tx) => {
    const order = rows(await tx.execute({ sql: 'SELECT * FROM sales_orders WHERE id = ?', args: [id] }))[0];
    if (!order) throw new UserError('Order not found.');
    if (!canMove(SALES_FLOW, order.status, to)) throw new UserError(`A ${order.status} order cannot be marked ${to}.`);
    if (to === 'shipped') {
      const lines = rows(await tx.execute({ sql: 'SELECT l.product_id, l.qty, p.sku FROM sales_lines l JOIN products p ON p.id = l.product_id WHERE l.order_id = ?', args: [id] }));
      const ids = [...new Set(lines.map((l) => l.product_id))];
      const stock = Object.fromEntries(rows(await tx.execute({
        sql: `SELECT product_id, SUM(qty) AS n FROM stock_moves WHERE product_id IN (${ids.map(() => '?').join(',')}) GROUP BY product_id`, args: ids,
      })).map((r) => [r.product_id, Number(r.n)]));
      const short = shortages(lines, stock);
      if (short.length) {
        const sku = (pid) => lines.find((l) => l.product_id === pid).sku;
        throw new UserError(`Not enough stock to ship: ${short.map((s) => `${sku(s.product_id)} needs ${s.needed}, has ${s.on_hand}`).join('; ')}.`);
      }
      for (const l of lines) {
        await tx.execute({ sql: "INSERT INTO stock_moves (product_id, qty, kind, reference, user_id) VALUES (?, ?, 'shipment', ?, ?)", args: [l.product_id, -l.qty, order.number, user.id] });
      }
      await tx.execute({ sql: "UPDATE sales_orders SET status = 'shipped', shipped_at = datetime('now') WHERE id = ?", args: [id] });
    } else if (to === 'paid') {
      await tx.execute({ sql: "UPDATE sales_orders SET status = 'paid', paid_at = datetime('now') WHERE id = ?", args: [id] });
    } else {
      await tx.execute({ sql: 'UPDATE sales_orders SET status = ? WHERE id = ?', args: [to, id] });
    }
    await audit(tx, user.id, `marked ${to}`, 'sales order', id, order.number);
  });
}

// ---------- Purchase orders ----------
export async function listPurchases({ status = '' } = {}) {
  const orders = await q(`SELECT o.*, s.name AS supplier FROM purchase_orders o JOIN partners s ON s.id = o.supplier_id
      WHERE (? = '' OR o.status = ?) ORDER BY o.order_date DESC, o.id DESC`, [status, status]);
  const lines = await linesWithTotals('purchase_lines', orders.map((o) => o.id));
  return orders.map((o) => ({ ...o, ...orderTotals(lines[o.id] || [], 0) }));
}

export async function getPurchase(id) {
  const order = await one(`SELECT o.*, s.name AS supplier, s.contact, s.email AS supplier_email, u.name AS created_by_name
      FROM purchase_orders o JOIN partners s ON s.id = o.supplier_id LEFT JOIN users u ON u.id = o.created_by WHERE o.id = ?`, [id]);
  if (!order) return null;
  const lines = await q(`SELECT l.*, p.sku, p.name, p.unit, p.cost_cents FROM purchase_lines l JOIN products p ON p.id = l.product_id
      WHERE l.order_id = ? ORDER BY l.id`, [id]);
  return { ...order, lines, ...orderTotals(lines, 0) };
}

export async function createPurchase(user, { supplierId, orderDate, expectedDate, notes, lines }) {
  return withTx(async (tx) => {
    const supplier = rows(await tx.execute({ sql: "SELECT id FROM partners WHERE id = ? AND kind = 'supplier'", args: [supplierId] }))[0];
    if (!supplier) throw new UserError('Choose a supplier.');
    const number = await nextNumber(tx, 'purchase_orders', 'PO', 2000);
    const r = await tx.execute({
      sql: "INSERT INTO purchase_orders (number, supplier_id, status, order_date, expected_date, notes, created_by) VALUES (?, ?, 'draft', ?, ?, ?, ?)",
      args: [number, supplierId, orderDate, expectedDate || null, notes || null, user.id],
    });
    const id = Number(r.lastInsertRowid);
    for (const l of lines) {
      const p = rows(await tx.execute({ sql: 'SELECT id, cost_cents FROM products WHERE id = ?', args: [l.productId] }))[0];
      if (!p) throw new UserError('One of the products no longer exists.');
      await tx.execute({ sql: 'INSERT INTO purchase_lines (order_id, product_id, qty, unit_cents) VALUES (?, ?, ?, ?)', args: [id, p.id, l.qty, l.unitCents ?? p.cost_cents] });
    }
    await audit(tx, user.id, 'created', 'purchase order', id, number);
    return id;
  });
}

/** Receiving adds stock and updates each product's moving average cost. */
export async function transitionPurchase(user, id, to) {
  return withTx(async (tx) => {
    const order = rows(await tx.execute({ sql: 'SELECT * FROM purchase_orders WHERE id = ?', args: [id] }))[0];
    if (!order) throw new UserError('Purchase order not found.');
    if (!canMove(PURCHASE_FLOW, order.status, to)) throw new UserError(`A ${order.status} purchase order cannot be marked ${to}.`);
    if (to === 'received') {
      const lines = rows(await tx.execute({ sql: 'SELECT product_id, qty, unit_cents FROM purchase_lines WHERE order_id = ?', args: [id] }));
      for (const l of lines) {
        const p = rows(await tx.execute({
          sql: 'SELECT cost_cents, COALESCE((SELECT SUM(qty) FROM stock_moves WHERE product_id = ?), 0) AS on_hand FROM products WHERE id = ?',
          args: [l.product_id, l.product_id],
        }))[0];
        const cost = averageCost(Number(p.on_hand), Number(p.cost_cents), Number(l.qty), Number(l.unit_cents));
        await tx.execute({ sql: 'UPDATE products SET cost_cents = ? WHERE id = ?', args: [cost, l.product_id] });
        await tx.execute({ sql: "INSERT INTO stock_moves (product_id, qty, kind, reference, user_id) VALUES (?, ?, 'receipt', ?, ?)", args: [l.product_id, l.qty, order.number, user.id] });
      }
      await tx.execute({ sql: "UPDATE purchase_orders SET status = 'received', received_at = datetime('now') WHERE id = ?", args: [id] });
    } else {
      await tx.execute({ sql: 'UPDATE purchase_orders SET status = ? WHERE id = ?', args: [to, id] });
    }
    await audit(tx, user.id, `marked ${to}`, 'purchase order', id, order.number);
  });
}

// ---------- Dashboard ----------
export async function dashboard(today) {
  const monthStart = today.slice(0, 8) + '01';
  const from30 = new Date(Date.parse(today) - 29 * 86400e3).toISOString().slice(0, 10);
  const shipped = await q(`SELECT o.id, o.order_date, o.status, o.tax_rate FROM sales_orders o WHERE o.status IN ('shipped','paid') AND o.order_date >= ?`, [from30 < monthStart ? from30 : monthStart]);
  const lines = await linesWithTotals('sales_lines', shipped.map((o) => o.id));
  const byDay = {};
  let month = 0;
  for (const o of shipped) {
    const t = orderTotals(lines[o.id] || [], o.tax_rate).subtotal;
    if (o.order_date >= from30) byDay[o.order_date] = (byDay[o.order_date] || 0) + t;
    if (o.order_date >= monthStart) month += t;
  }
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.parse(from30) + i * 86400e3).toISOString().slice(0, 10);
    return { date: d, cents: byDay[d] || 0 };
  });

  const open = await listSales({ status: 'confirmed' });
  const unpaid = await listSales({ status: 'shipped' });
  const products = (await q(STOCK_SQL)).map(withStatus);
  const low = products.filter((p) => p.level !== 'ok').sort((a, b) => a.available - b.available);
  const inventoryValue = products.reduce((s, p) => s + Math.max(p.on_hand, 0) * p.cost_cents, 0);
  const top = await q(`SELECT p.name, p.sku, SUM(l.qty) AS qty, SUM(l.qty * l.unit_cents) AS cents
      FROM sales_lines l JOIN sales_orders o ON o.id = l.order_id JOIN products p ON p.id = l.product_id
      WHERE o.status IN ('shipped','paid') AND o.order_date >= ? GROUP BY p.id ORDER BY cents DESC LIMIT 5`, [from30]);
  const recent = (await listSales()).slice(0, 6);
  return {
    monthSales: month,
    openOrders: { count: open.length, value: open.reduce((s, o) => s + o.total, 0) },
    unpaid: { count: unpaid.length, value: unpaid.reduce((s, o) => s + o.total, 0) },
    inventoryValue, low, series, top, recent,
  };
}

// ---------- Users & audit ----------
export async function listUsers() {
  return q('SELECT id, email, name, role, active, created_at FROM users ORDER BY id');
}

export async function createUser(admin, { email, name, role, passwordHash }) {
  return withTx(async (tx) => {
    const exists = rows(await tx.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] }))[0];
    if (exists) throw new UserError('A user with that email already exists.');
    const r = await tx.execute({ sql: 'INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)', args: [email, name, role, passwordHash] });
    await audit(tx, admin.id, 'created', 'user', Number(r.lastInsertRowid), `${email} as ${role}`);
  });
}

export async function updateUser(admin, { id, role, active }) {
  if (id === admin.id && (role !== 'admin' || !active)) throw new UserError('You cannot remove your own administrator access.');
  return withTx(async (tx) => {
    await tx.execute({ sql: 'UPDATE users SET role = ?, active = ? WHERE id = ?', args: [role, active ? 1 : 0, id] });
    await audit(tx, admin.id, 'updated', 'user', id, `${role}${active ? '' : ', deactivated'}`);
  });
}

export async function findUserByEmail(email) {
  return one('SELECT * FROM users WHERE email = ? AND active = 1', [email]);
}

export async function listAudit(limit = 100) {
  return q(`SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ?`, [limit]);
}

export async function exportRows(entity) {
  if (entity === 'products') {
    return (await q(STOCK_SQL + ' ORDER BY p.sku')).map(withStatus).map((p) => ({
      SKU: p.sku, Name: p.name, Category: p.category, Unit: p.unit, Price: (p.price_cents / 100).toFixed(2), 'Avg cost': (p.cost_cents / 100).toFixed(2),
      'On hand': p.on_hand, Reserved: p.reserved, Available: p.available, Incoming: p.incoming, 'Reorder level': p.reorder_level, Status: p.level,
    }));
  }
  if (entity === 'sales') {
    return (await listSales()).map((o) => ({
      Number: o.number, Date: o.order_date, Customer: o.customer, Status: o.status,
      Subtotal: (o.subtotal / 100).toFixed(2), Tax: (o.tax / 100).toFixed(2), Total: (o.total / 100).toFixed(2),
    }));
  }
  return null;
}
