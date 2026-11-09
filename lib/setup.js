// Schema and starter data. Runs automatically on the first request.
import { hashPassword } from './password.js';
import { averageCost } from './inventory.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','sales','warehouse')),
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'each',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('customer','supplier')),
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES partners(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','shipped','paid','cancelled')),
  order_date TEXT NOT NULL,
  tax_rate REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  shipped_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sales_lines (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_cents INTEGER NOT NULL CHECK (unit_cents >= 0)
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL REFERENCES partners(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','received','cancelled')),
  order_date TEXT NOT NULL,
  expected_date TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS purchase_lines (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_cents INTEGER NOT NULL CHECK (unit_cents >= 0)
);
CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('opening','receipt','shipment','adjustment')),
  reference TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS moves_by_product ON stock_moves (product_id);
CREATE INDEX IF NOT EXISTS so_by_status ON sales_orders (status, order_date);
CREATE INDEX IF NOT EXISTS sl_by_order ON sales_lines (order_id);
CREATE INDEX IF NOT EXISTS pl_by_order ON purchase_lines (order_id);
`;

const COMPANY = {
  company_name: 'Kestrel Supply Co.',
  company_address: '418 Foundry Rd, Columbus, OH 43215',
  company_email: 'orders@kestrel-supply.example',
  currency: 'USD',
  tax_rate: '0.08',
  payment_terms: 'Net 30',
};

// sku, name, category, unit, price, cost, reorder level, opening stock
const PRODUCTS = [
  ['FAS-HXB-0516', 'Hex bolt 5/16" × 2", zinc (box of 100)', 'Fasteners', 'box', 1890, 1040, 20, 140],
  ['FAS-WDS-0834', 'Wood screw #8 × 3/4", Phillips (box of 200)', 'Fasteners', 'box', 1250, 610, 25, 180],
  ['FAS-ANC-0038', 'Concrete anchor 3/8" × 3" (pack of 25)', 'Fasteners', 'pack', 2440, 1310, 15, 46],
  ['FAS-WSH-0038', 'Flat washer 3/8", stainless (box of 100)', 'Fasteners', 'box', 1560, 820, 20, 12],
  ['PWR-DRL-20V', '20V cordless drill/driver kit', 'Power Tools', 'each', 14900, 9150, 6, 24],
  ['PWR-IMP-20V', '20V impact driver, tool only', 'Power Tools', 'each', 11900, 7300, 5, 18],
  ['PWR-SAW-0714', '7-1/4" circular saw, 15A corded', 'Power Tools', 'each', 12900, 8100, 4, 9],
  ['PWR-BAT-20V5', '20V 5.0Ah lithium battery', 'Power Tools', 'each', 8900, 5200, 10, 6],
  ['HND-HAM-16', '16 oz fiberglass claw hammer', 'Hand Tools', 'each', 2490, 1180, 10, 60],
  ['HND-TAP-25', '25 ft tape measure, magnetic tip', 'Hand Tools', 'each', 1990, 870, 12, 75],
  ['HND-LVL-48', '48" aluminum box level', 'Hand Tools', 'each', 4590, 2460, 6, 22],
  ['HND-SCR-SET', 'Screwdriver set, 10 piece', 'Hand Tools', 'set', 3290, 1610, 8, 31],
  ['SAF-GLV-L', 'Cut-resistant work gloves, size L (12 pairs)', 'Safety', 'dozen', 5400, 2900, 10, 38],
  ['SAF-GLS-CLR', 'Safety glasses, clear, ANSI Z87.1 (pack of 12)', 'Safety', 'pack', 3600, 1750, 10, 44],
  ['SAF-HHT-WHT', 'Hard hat, ratchet suspension, white', 'Safety', 'each', 2290, 1120, 12, 9],
  ['SAF-VST-HV', 'Hi-vis vest, Class 2, L/XL', 'Safety', 'each', 1490, 610, 20, 120],
  ['ELE-WIR-1202', '12/2 NM-B wire with ground, 250 ft', 'Electrical', 'roll', 15900, 11200, 5, 16],
  ['ELE-OUT-20A', 'Tamper-resistant duplex outlet 20A (10 pack)', 'Electrical', 'pack', 3990, 2150, 8, 27],
  ['ELE-BRK-20', '20A single-pole breaker', 'Electrical', 'each', 1190, 640, 15, 7],
  ['ELE-LED-4FT', '4 ft LED shop light, 5000K', 'Electrical', 'each', 3490, 1980, 10, 40],
  ['ADH-CON-10', 'Construction adhesive, 10 oz cartridge (case of 12)', 'Adhesives', 'case', 4680, 2600, 6, 30],
  ['ADH-SIL-CLR', '100% silicone sealant, clear, 10 oz', 'Adhesives', 'each', 890, 420, 24, 150],
  ['ADH-TAP-DCT', 'Duct tape 2" × 60 yd, silver', 'Adhesives', 'roll', 990, 450, 24, 96],
  ['ADH-EPX-25', 'Two-part epoxy, 25 ml syringe', 'Adhesives', 'each', 790, 330, 20, 64],
];

const CUSTOMERS = [
  ['Brightline Builders', 'Erin Walsh', 'Columbus'],
  ['Cedar & Stone Renovations', 'Marco Diaz', 'Dublin'],
  ['Metro Facilities Group', 'Priya Raman', 'Columbus'],
  ['Harbor Marine Services', 'Dale Hughes', 'Sandusky'],
  ['Summit Electrical Contractors', 'Kim Tran', 'Westerville'],
  ['Oakridge Property Management', 'Laura Benson', 'Grove City'],
  ['Riverside Fabrication', 'Owen Park', 'Dayton'],
  ['Northgate Home Services', 'Tasha Reed', 'Delaware'],
];

const SUPPLIERS = [
  ['Atlas Fastener Supply', 'Greg Collins', 'Cleveland'],
  ['Voltworks Distribution', 'Ana Silva', 'Cincinnati'],
  ['Ironclad Tools Wholesale', 'Ray Morgan', 'Toledo'],
  ['SafeGuard PPE', 'Mei Lin', 'Akron'],
];

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d) => d.toISOString().slice(0, 10);
const sqlTs = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const daysAgo = (n) => new Date(Date.now() - n * 86400e3);

export async function setupDatabase(client, { reset = false, demo = process.env.DEMO_MODE === 'true' } = {}) {
  if (reset) {
    await client.executeMultiple(`
      DROP TABLE IF EXISTS audit_log; DROP TABLE IF EXISTS stock_moves;
      DROP TABLE IF EXISTS purchase_lines; DROP TABLE IF EXISTS purchase_orders;
      DROP TABLE IF EXISTS sales_lines; DROP TABLE IF EXISTS sales_orders;
      DROP TABLE IF EXISTS partners; DROP TABLE IF EXISTS products;
      DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS settings;`);
  }
  await client.executeMultiple(SCHEMA);
  const users = Number((await client.execute('SELECT COUNT(*) FROM users')).rows[0][0]);
  if (users > 0) return { seeded: false };

  const s = [];
  for (const [k, v] of Object.entries(COMPANY)) s.push({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', args: [k, v] });

  if (!demo) {
    // Real installs start empty except for one administrator.
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD;
    if (!password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD for the first administrator (or DEMO_MODE=true).');
    s.push({ sql: "INSERT OR IGNORE INTO users (email, name, role, password_hash) VALUES (?, 'Administrator', 'admin', ?)", args: [email, await hashPassword(password)] });
    await client.batch(s, 'write');
    return { seeded: true, demo: false };
  }

  const demoPass = await hashPassword(process.env.DEMO_PASSWORD || 'demo1234');
  for (const [email, name, role] of [
    ['admin@kestrel.demo', 'Jordan Avery', 'admin'],
    ['sales@kestrel.demo', 'Riley Chen', 'sales'],
    ['warehouse@kestrel.demo', 'Sam Okafor', 'warehouse'],
  ]) s.push({ sql: 'INSERT OR IGNORE INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)', args: [email, name, role, demoPass] });

  PRODUCTS.forEach(([sku, name, category, unit, price, cost, reorder]) =>
    s.push({ sql: 'INSERT INTO products (sku, name, category, unit, price_cents, cost_cents, reorder_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', args: [sku, name, category, unit, price, cost, reorder, sqlTs(daysAgo(70))] }));
  for (const [name, contact, city] of CUSTOMERS)
    s.push({ sql: "INSERT INTO partners (kind, name, contact, email, phone, city) VALUES ('customer', ?, ?, ?, ?, ?)", args: [name, contact, `${contact.split(' ')[0].toLowerCase()}@${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`, `(614) 555-01${String(s.length % 90 + 10)}`, city] });
  for (const [name, contact, city] of SUPPLIERS)
    s.push({ sql: "INSERT INTO partners (kind, name, contact, email, phone, city) VALUES ('supplier', ?, ?, ?, ?, ?)", args: [name, contact, `${contact.split(' ')[0].toLowerCase()}@${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`, `(216) 555-01${String(s.length % 90 + 10)}`, city] });
  await client.batch(s, 'write');

  // ---- Simulated history: opening stock, purchases, sales ----
  const rand = rng(20261109);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const products = PRODUCTS.map((p, i) => ({ id: i + 1, sku: p[0], unit: p[3], price: p[4], cost: p[5], onHand: p[7] }));
  const customers = CUSTOMERS.map((_, i) => i + 1);
  const suppliers = SUPPLIERS.map((_, i) => CUSTOMERS.length + i + 1);
  const ops = [];

  for (const p of products)
    ops.push({ sql: "INSERT INTO stock_moves (product_id, qty, kind, reference, user_id, created_at) VALUES (?, ?, 'opening', 'Opening balance', 3, ?)", args: [p.id, p.onHand, sqlTs(daysAgo(65))] });

  // Purchases received in the past, plus open and draft ones.
  const poPlan = [[52, 'received'], [38, 'received'], [21, 'received'], [9, 'ordered'], [4, 'ordered'], [1, 'draft']];
  poPlan.forEach(([ago, status], i) => {
    const number = `PO-${2001 + i}`;
    const supplier = suppliers[i % suppliers.length];
    const date = daysAgo(ago);
    ops.push({
      sql: 'INSERT INTO purchase_orders (id, number, supplier_id, status, order_date, expected_date, created_by, received_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 3, ?, ?)',
      args: [i + 1, number, supplier, status, iso(date), iso(new Date(date.getTime() + 7 * 86400e3)), status === 'received' ? sqlTs(new Date(date.getTime() + 6 * 86400e3)) : null, sqlTs(date)],
    });
    const chosen = new Set();
    while (chosen.size < 3 + (i % 2)) chosen.add(pick(products));
    for (const p of chosen) {
      const qty = p.unit === 'each' || p.unit === 'roll' ? 10 + Math.floor(rand() * 15) : 20 + Math.floor(rand() * 40);
      const unit = Math.round(p.cost * (0.94 + rand() * 0.1));
      ops.push({ sql: 'INSERT INTO purchase_lines (order_id, product_id, qty, unit_cents) VALUES (?, ?, ?, ?)', args: [i + 1, p.id, qty, unit] });
      if (status === 'received') {
        p.cost = averageCost(p.onHand, p.cost, qty, unit);
        p.onHand += qty;
        ops.push({ sql: "INSERT INTO stock_moves (product_id, qty, kind, reference, user_id, created_at) VALUES (?, ?, 'receipt', ?, 3, ?)", args: [p.id, qty, number, sqlTs(new Date(date.getTime() + 6 * 86400e3))] });
      }
    }
  });

  // Sales over the last 60 days. Older orders are paid, newer ones still moving.
  const taxRate = Number(COMPANY.tax_rate);
  let soId = 0;
  for (let ago = 60; ago >= 0; ago--) {
    const perDay = ago % 7 === 0 || ago % 7 === 6 ? 0 : (rand() < 0.75 ? 1 : 0) + (rand() < 0.3 ? 1 : 0);
    for (let k = 0; k < perDay; k++) {
      soId++;
      const date = daysAgo(ago);
      let status = ago > 30 ? (rand() < 0.92 ? 'paid' : 'cancelled')
        : ago > 12 ? (rand() < 0.55 ? 'paid' : 'shipped')
        : ago > 3 ? pick(['shipped', 'confirmed', 'confirmed', 'paid'])
        : pick(['confirmed', 'draft', 'confirmed']);
      const lines = [];
      const chosen = new Set();
      const count = 1 + Math.floor(rand() * 4);
      while (chosen.size < count) chosen.add(pick(products));
      for (const p of chosen) {
        const qty = p.unit === 'each' || p.unit === 'roll' ? 1 + Math.floor(rand() * 4) : 2 + Math.floor(rand() * 8);
        lines.push({ p, qty });
      }
      if ((status === 'shipped' || status === 'paid') && lines.some((l) => l.p.onHand < l.qty)) status = 'confirmed';
      ops.push({
        sql: 'INSERT INTO sales_orders (id, number, customer_id, status, order_date, tax_rate, created_by, shipped_at, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 2, ?, ?, ?)',
        args: [soId, `SO-${1000 + soId}`, pick(customers), status, iso(date), taxRate,
          status === 'shipped' || status === 'paid' ? sqlTs(new Date(date.getTime() + 86400e3)) : null,
          status === 'paid' ? sqlTs(new Date(date.getTime() + 12 * 86400e3)) : null, sqlTs(date)],
      });
      for (const { p, qty } of lines) {
        ops.push({ sql: 'INSERT INTO sales_lines (order_id, product_id, qty, unit_cents) VALUES (?, ?, ?, ?)', args: [soId, p.id, qty, p.price] });
        if (status === 'shipped' || status === 'paid') {
          p.onHand -= qty;
          ops.push({ sql: "INSERT INTO stock_moves (product_id, qty, kind, reference, user_id, created_at) VALUES (?, ?, 'shipment', ?, 3, ?)", args: [p.id, -qty, `SO-${1000 + soId}`, sqlTs(new Date(date.getTime() + 86400e3))] });
        }
      }
    }
  }
  for (const p of products) ops.push({ sql: 'UPDATE products SET cost_cents = ? WHERE id = ?', args: [p.cost, p.id] });
  ops.push({ sql: "INSERT INTO audit_log (user_id, action, entity, detail) VALUES (1, 'seeded', 'system', 'Demo company created')", args: [] });
  await client.batch(ops, 'write');
  return { seeded: true, demo: true, products: products.length, sales: soId };
}
