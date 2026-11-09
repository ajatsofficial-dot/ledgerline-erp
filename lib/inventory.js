// Pure business rules, kept free of database code so they can be unit tested.

/** Moving average cost after receiving `qty` units at `unitCost` (all money in cents). */
export function averageCost(onHand, currentCost, qty, unitCost) {
  if (qty <= 0) return currentCost;
  const base = Math.max(onHand, 0);
  if (base + qty === 0) return unitCost;
  return Math.round((base * currentCost + qty * unitCost) / (base + qty));
}

/** Subtotal, tax and total for order lines [{qty, unit_cents}] with a decimal tax rate (0.1 = 10%). */
export function orderTotals(lines, taxRate = 0) {
  const subtotal = lines.reduce((sum, l) => sum + Math.round(Number(l.qty) * Number(l.unit_cents)), 0);
  const tax = Math.round(subtotal * taxRate);
  return { subtotal, tax, total: subtotal + tax };
}

/**
 * Lines that cannot ship because there is not enough stock on hand.
 * `lines` may repeat a product; quantities are summed per product.
 * @returns {{product_id:number, needed:number, on_hand:number}[]}
 */
export function shortages(lines, onHandByProduct) {
  const need = new Map();
  for (const l of lines) need.set(l.product_id, (need.get(l.product_id) || 0) + Number(l.qty));
  const out = [];
  for (const [product_id, needed] of need) {
    const on_hand = Number(onHandByProduct[product_id] || 0);
    if (on_hand < needed) out.push({ product_id, needed, on_hand });
  }
  return out;
}

/** Stock status for a product given what is on hand, reserved by open orders, and its reorder level. */
export function stockStatus({ onHand, reserved = 0, reorderLevel = 0 }) {
  const available = onHand - reserved;
  if (available <= 0) return { available, level: 'out' };
  if (available <= reorderLevel) return { available, level: 'low' };
  return { available, level: 'ok' };
}

/** Allowed status changes for sales and purchase orders. */
export const SALES_FLOW = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['paid'],
  paid: [],
  cancelled: [],
};

export const PURCHASE_FLOW = {
  draft: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

export function canMove(flow, from, to) {
  return Boolean(flow[from] && flow[from].includes(to));
}
