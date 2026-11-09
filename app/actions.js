'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSession, destroySession, requireUser } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import * as db from '@/lib/queries';
import { adjustSchema, partnerSchema, productSchema, purchaseSchema, saleSchema, userSchema } from '@/lib/validation';
import { todayIso } from '@/lib/format';

const back = (path, key, msg) => `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`;
const firstIssue = (r) => r.error.issues[0].message;

/** Run an action body; turn expected errors into a message on `errorPath`. */
async function attempt(errorPath, fn) {
  try {
    return { result: await fn() };
  } catch (err) {
    if (err instanceof db.UserError) return { error: back(errorPath, 'error', err.message) };
    throw err;
  }
}

// ---------- Session ----------
export async function login(_prev, formData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const user = email ? await db.findUserByEmail(email) : null;
  const ok = user && (await verifyPassword(String(formData.get('password') || ''), user.password_hash));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 500));
    return { error: 'Email or password is not right.' };
  }
  await createSession(user.id);
  redirect('/');
}

export async function logout() {
  destroySession();
  redirect('/login');
}

// ---------- Products ----------
export async function saveProduct(formData) {
  const user = await requireUser('products.edit');
  const id = formData.get('id') ? Number(formData.get('id')) : undefined;
  const path = id ? `/products/${id}` : '/products/new';
  const parsed = productSchema.safeParse({
    id, sku: formData.get('sku') ?? '', name: formData.get('name') ?? '', category: formData.get('category') ?? '',
    unit: formData.get('unit') ?? 'each', priceCents: String(formData.get('price') ?? ''), costCents: formData.get('cost') != null ? String(formData.get('cost')) : undefined,
    reorderLevel: formData.get('reorderLevel') ?? 0, openingQty: formData.get('openingQty') ?? 0, active: id ? formData.get('active') === 'on' : true,
  });
  if (!parsed.success) redirect(back(path, 'error', firstIssue(parsed)));
  const { result, error } = await attempt(path, () => db.saveProduct(user, { ...parsed.data, costCents: parsed.data.costCents ?? 0 }));
  if (error) redirect(error);
  revalidatePath('/products');
  redirect(back(`/products/${result}`, 'ok', id ? 'Product saved.' : 'Product created.'));
}

export async function adjustStock(formData) {
  const user = await requireUser('stock.adjust');
  const productId = Number(formData.get('productId'));
  const path = `/products/${productId}`;
  const parsed = adjustSchema.safeParse({ productId, qty: formData.get('qty'), reason: formData.get('reason') ?? '' });
  if (!parsed.success) redirect(back(path, 'error', firstIssue(parsed)));
  const { error } = await attempt(path, () => db.adjustStock(user, parsed.data));
  if (error) redirect(error);
  revalidatePath(path);
  redirect(back(path, 'ok', 'Stock adjusted.'));
}

// ---------- Partners ----------
export async function createPartner(formData) {
  const user = await requireUser('partners.edit');
  const kind = formData.get('kind') === 'supplier' ? 'supplier' : 'customer';
  const path = `/partners?kind=${kind}`;
  const parsed = partnerSchema.safeParse({
    kind, name: formData.get('name') ?? '', contact: formData.get('contact') ?? '', email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '', city: formData.get('city') ?? '',
  });
  if (!parsed.success) redirect(back(path, 'error', firstIssue(parsed)));
  const { error } = await attempt(path, () => db.createPartner(user, parsed.data));
  if (error) redirect(error);
  revalidatePath('/partners');
  redirect(back(path, 'ok', `${parsed.data.name} added.`));
}

// ---------- Orders ----------
function parseLines(formData) {
  try {
    return JSON.parse(String(formData.get('lines') || '[]'));
  } catch {
    return [];
  }
}

export async function createSale(_prev, formData) {
  const user = await requireUser('sales.edit');
  const parsed = saleSchema.safeParse({
    customerId: formData.get('partnerId'), orderDate: formData.get('orderDate') || todayIso(), notes: formData.get('notes') ?? '', lines: parseLines(formData),
  });
  if (!parsed.success) return { error: firstIssue(parsed) };
  const { taxRate } = await db.getSettings();
  let id;
  try {
    id = await db.createSale(user, parsed.data, taxRate);
  } catch (err) {
    if (err instanceof db.UserError) return { error: err.message };
    throw err;
  }
  revalidatePath('/sales');
  redirect(back(`/sales/${id}`, 'ok', 'Sales order created as a draft. Confirm it to reserve stock.'));
}

const SALE_PERMS = { confirmed: 'sales.confirm', shipped: 'sales.ship', paid: 'sales.pay', cancelled: 'sales.cancel' };
const SALE_MSG = { confirmed: 'Order confirmed. Stock is now reserved.', shipped: 'Order shipped. Stock has been deducted.', paid: 'Payment recorded.', cancelled: 'Order cancelled.' };

export async function moveSale(formData) {
  const to = String(formData.get('to'));
  const id = Number(formData.get('id'));
  if (!SALE_PERMS[to]) redirect(`/sales/${id}`);
  const user = await requireUser(SALE_PERMS[to]);
  const { error } = await attempt(`/sales/${id}`, () => db.transitionSale(user, id, to));
  if (error) redirect(error);
  revalidatePath('/sales');
  revalidatePath(`/sales/${id}`);
  redirect(back(`/sales/${id}`, 'ok', SALE_MSG[to]));
}

export async function createPurchase(_prev, formData) {
  const user = await requireUser('purchase.edit');
  const parsed = purchaseSchema.safeParse({
    supplierId: formData.get('partnerId'), orderDate: formData.get('orderDate') || todayIso(), expectedDate: formData.get('expectedDate') ?? '',
    notes: formData.get('notes') ?? '', lines: parseLines(formData),
  });
  if (!parsed.success) return { error: firstIssue(parsed) };
  let id;
  try {
    id = await db.createPurchase(user, parsed.data);
  } catch (err) {
    if (err instanceof db.UserError) return { error: err.message };
    throw err;
  }
  revalidatePath('/purchases');
  redirect(back(`/purchases/${id}`, 'ok', 'Purchase order created as a draft.'));
}

const PO_PERMS = { ordered: 'purchase.edit', received: 'purchase.receive', cancelled: 'purchase.edit' };
const PO_MSG = { ordered: 'Marked as ordered. Quantities now show as incoming.', received: 'Goods received. Stock and average cost updated.', cancelled: 'Purchase order cancelled.' };

export async function movePurchase(formData) {
  const to = String(formData.get('to'));
  const id = Number(formData.get('id'));
  if (!PO_PERMS[to]) redirect(`/purchases/${id}`);
  const user = await requireUser(PO_PERMS[to]);
  const { error } = await attempt(`/purchases/${id}`, () => db.transitionPurchase(user, id, to));
  if (error) redirect(error);
  revalidatePath('/purchases');
  revalidatePath(`/purchases/${id}`);
  redirect(back(`/purchases/${id}`, 'ok', PO_MSG[to]));
}

// ---------- Users ----------
export async function createUser(formData) {
  const admin = await requireUser('users.manage');
  const parsed = userSchema.safeParse({
    email: formData.get('email') ?? '', name: formData.get('name') ?? '', role: formData.get('role'), password: formData.get('password') ?? '',
  });
  if (!parsed.success) redirect(back('/users', 'error', firstIssue(parsed)));
  const { error } = await attempt('/users', async () =>
    db.createUser(admin, { ...parsed.data, passwordHash: await hashPassword(parsed.data.password) }));
  if (error) redirect(error);
  revalidatePath('/users');
  redirect(back('/users', 'ok', `${parsed.data.name} can now sign in.`));
}

export async function updateUser(formData) {
  const admin = await requireUser('users.manage');
  const role = String(formData.get('role'));
  if (!['admin', 'sales', 'warehouse'].includes(role)) redirect('/users');
  const { error } = await attempt('/users', () =>
    db.updateUser(admin, { id: Number(formData.get('id')), role, active: formData.get('active') === 'on' }));
  if (error) redirect(error);
  revalidatePath('/users');
  redirect(back('/users', 'ok', 'User updated.'));
}
