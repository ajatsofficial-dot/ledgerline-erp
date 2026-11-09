import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageCost, canMove, orderTotals, PURCHASE_FLOW, SALES_FLOW, shortages, stockStatus } from '../lib/inventory.js';
import { can } from '../lib/permissions.js';
import { toCents } from '../lib/format.js';

test('moving average cost blends old stock with a new receipt', () => {
  assert.equal(averageCost(10, 1000, 10, 2000), 1500);
  assert.equal(averageCost(0, 1000, 5, 1200), 1200);
  assert.equal(averageCost(-3, 1000, 5, 1200), 1200); // negative stock never drags the average
  assert.equal(averageCost(10, 1000, 0, 5000), 1000);
});

test('order totals round tax once on the subtotal', () => {
  const t = orderTotals([{ qty: 3, unit_cents: 1890 }, { qty: 1, unit_cents: 14900 }], 0.08);
  assert.deepEqual(t, { subtotal: 20570, tax: 1646, total: 22216 });
  assert.deepEqual(orderTotals([], 0.08), { subtotal: 0, tax: 0, total: 0 });
});

test('shortages sum repeated products and report what is missing', () => {
  const lines = [{ product_id: 1, qty: 4 }, { product_id: 1, qty: 3 }, { product_id: 2, qty: 1 }];
  assert.deepEqual(shortages(lines, { 1: 6, 2: 5 }), [{ product_id: 1, needed: 7, on_hand: 6 }]);
  assert.deepEqual(shortages(lines, { 1: 7, 2: 1 }), []);
});

test('stock status uses available = on hand − reserved', () => {
  assert.deepEqual(stockStatus({ onHand: 20, reserved: 5, reorderLevel: 10 }), { available: 15, level: 'ok' });
  assert.deepEqual(stockStatus({ onHand: 12, reserved: 4, reorderLevel: 10 }), { available: 8, level: 'low' });
  assert.deepEqual(stockStatus({ onHand: 3, reserved: 3, reorderLevel: 10 }), { available: 0, level: 'out' });
});

test('order status flows only move forward', () => {
  assert.ok(canMove(SALES_FLOW, 'draft', 'confirmed'));
  assert.ok(canMove(SALES_FLOW, 'confirmed', 'shipped'));
  assert.ok(!canMove(SALES_FLOW, 'draft', 'shipped'));
  assert.ok(!canMove(SALES_FLOW, 'paid', 'cancelled'));
  assert.ok(canMove(PURCHASE_FLOW, 'ordered', 'received'));
  assert.ok(!canMove(PURCHASE_FLOW, 'received', 'cancelled'));
});

test('roles get only their permissions', () => {
  assert.ok(can('sales', 'sales.edit'));
  assert.ok(!can('sales', 'sales.ship'));
  assert.ok(can('warehouse', 'sales.ship'));
  assert.ok(!can('warehouse', 'sales.pay'));
  assert.ok(!can('sales', 'users.manage'));
  assert.ok(can('admin', 'users.manage'));
  assert.ok(!can('admin', 'made.up'));
});

test('money input parsing', () => {
  assert.equal(toCents('12.5'), 1250);
  assert.equal(toCents('$1,299.99'), 129999);
  assert.ok(Number.isNaN(toCents('12.999')));
  assert.ok(Number.isNaN(toCents('abc')));
});
